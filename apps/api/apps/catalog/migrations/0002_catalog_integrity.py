from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial"), ("sellers", "0005_lifecycle_integrity")]
    operations = [
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION catalog_check_category_tree() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            PERFORM pg_advisory_xact_lock(51005);
            IF NEW.parent_id IS NOT NULL AND EXISTS (
                WITH RECURSIVE ancestors(id,parent_id) AS (
                    SELECT id,parent_id FROM catalog_category WHERE id = NEW.parent_id
                    UNION
                    SELECT c.id,c.parent_id FROM catalog_category c
                    JOIN ancestors a ON c.id = a.parent_id
                ) SELECT 1 FROM ancestors WHERE id = NEW.id
            ) THEN
                RAISE EXCEPTION 'Category cycle rejected' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;
        CREATE TRIGGER catalog_category_tree BEFORE INSERT OR UPDATE ON catalog_category
        FOR EACH ROW EXECUTE FUNCTION catalog_check_category_tree();

        CREATE FUNCTION catalog_check_child_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            parent_seller uuid;
            category_uuid uuid;
            attribute_kind text;
            attribute_scope text;
            option_attribute uuid;
        BEGIN
            IF TG_TABLE_NAME = 'catalog_variantattributevalue' THEN
                SELECT p.seller_id,p.category_id INTO parent_seller,category_uuid
                FROM catalog_productvariant v JOIN catalog_product p ON p.id = v.product_id
                WHERE v.id = NEW.variant_id FOR KEY SHARE OF v,p;
            ELSE
                SELECT seller_id,category_id INTO parent_seller,category_uuid
                FROM catalog_product WHERE id = NEW.product_id FOR KEY SHARE;
            END IF;
            IF parent_seller IS DISTINCT FROM NEW.seller_id THEN
                RAISE EXCEPTION 'Catalog tenant scope rejected' USING ERRCODE = '23514';
            END IF;
            IF TG_TABLE_NAME IN (
                'catalog_productattributevalue','catalog_variantattributevalue'
            ) THEN
                SELECT value_type,scope INTO attribute_kind,attribute_scope
                FROM catalog_attribute WHERE id = NEW.attribute_id FOR KEY SHARE;
                IF NOT EXISTS (SELECT 1 FROM catalog_categoryattribute
                    WHERE category_id = category_uuid AND attribute_id = NEW.attribute_id)
                   OR (TG_TABLE_NAME = 'catalog_productattributevalue'
                       AND attribute_scope != 'product')
                   OR (TG_TABLE_NAME = 'catalog_variantattributevalue'
                       AND attribute_scope != 'variant')
                THEN
                    RAISE EXCEPTION 'Attribute category/scope rejected' USING ERRCODE = '23514';
                END IF;
                IF NEW.option_id IS NOT NULL THEN
                    SELECT attribute_id INTO option_attribute FROM catalog_attributeoption
                    WHERE id = NEW.option_id FOR KEY SHARE;
                    IF attribute_kind != 'choice'
                       OR option_attribute IS DISTINCT FROM NEW.attribute_id
                       OR NEW.value != '' THEN
                        RAISE EXCEPTION 'Attribute option rejected' USING ERRCODE = '23514';
                    END IF;
                ELSIF attribute_kind = 'choice' OR NEW.value = ''
                    OR (attribute_kind = 'boolean' AND NEW.value NOT IN ('true','false'))
                    OR (attribute_kind = 'number' AND NEW.value !~ '^[+-]?[0-9]+(\\.[0-9]+)?$')
                THEN
                    RAISE EXCEPTION 'Attribute value rejected' USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END; $$;
        CREATE TRIGGER catalog_variant_scope BEFORE INSERT OR UPDATE ON catalog_productvariant
        FOR EACH ROW EXECUTE FUNCTION catalog_check_child_scope();
        CREATE TRIGGER catalog_image_scope BEFORE INSERT OR UPDATE ON catalog_productimage
        FOR EACH ROW EXECUTE FUNCTION catalog_check_child_scope();
        CREATE TRIGGER catalog_product_value_scope
        BEFORE INSERT OR UPDATE ON catalog_productattributevalue
        FOR EACH ROW EXECUTE FUNCTION catalog_check_child_scope();
        CREATE TRIGGER catalog_variant_value_scope
        BEFORE INSERT OR UPDATE ON catalog_variantattributevalue
        FOR EACH ROW EXECUTE FUNCTION catalog_check_child_scope();
        CREATE TRIGGER catalog_history_scope BEFORE INSERT OR UPDATE ON catalog_productstatushistory
        FOR EACH ROW EXECUTE FUNCTION catalog_check_child_scope();

        CREATE TRIGGER catalog_product_tenant BEFORE UPDATE ON catalog_product
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
        CREATE TRIGGER catalog_variant_tenant BEFORE UPDATE ON catalog_productvariant
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
        CREATE TRIGGER catalog_image_tenant BEFORE UPDATE ON catalog_productimage
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
        CREATE TRIGGER catalog_product_value_tenant BEFORE UPDATE ON catalog_productattributevalue
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
        CREATE TRIGGER catalog_variant_value_tenant BEFORE UPDATE ON catalog_variantattributevalue
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
        CREATE TRIGGER catalog_history_immutable
        BEFORE UPDATE OR DELETE ON catalog_productstatushistory
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

        CREATE FUNCTION catalog_preserve_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_TABLE_NAME IN ('catalog_productvariant','catalog_productimage',
                                 'catalog_productattributevalue') THEN
                IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
                    RAISE EXCEPTION 'Product identity is immutable' USING ERRCODE = '23514';
                END IF;
            ELSIF TG_TABLE_NAME = 'catalog_variantattributevalue' THEN
                IF NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
                    RAISE EXCEPTION 'Variant identity is immutable' USING ERRCODE = '23514';
                END IF;
            ELSIF TG_TABLE_NAME = 'catalog_attribute' THEN
                IF (NEW.code,NEW.value_type,NEW.scope)
                   IS DISTINCT FROM (OLD.code,OLD.value_type,OLD.scope) THEN
                    RAISE EXCEPTION 'Attribute type is immutable' USING ERRCODE = '23514';
                END IF;
            ELSIF TG_TABLE_NAME = 'catalog_attributeoption' THEN
                IF (NEW.attribute_id,NEW.value)
                   IS DISTINCT FROM (OLD.attribute_id,OLD.value) THEN
                    RAISE EXCEPTION 'Option identity is immutable' USING ERRCODE = '23514';
                END IF;
            ELSIF TG_TABLE_NAME = 'catalog_categoryattribute' THEN
                IF (NEW.category_id,NEW.attribute_id)
                   IS DISTINCT FROM (OLD.category_id,OLD.attribute_id) THEN
                    RAISE EXCEPTION 'Category link is immutable' USING ERRCODE = '23514';
                END IF;
            ELSIF TG_TABLE_NAME = 'catalog_product' THEN
                IF NEW.category_id IS DISTINCT FROM OLD.category_id AND (
                    EXISTS (SELECT 1 FROM catalog_productattributevalue
                            WHERE product_id = OLD.id)
                    OR EXISTS (SELECT 1 FROM catalog_variantattributevalue av
                               JOIN catalog_productvariant v ON v.id = av.variant_id
                               WHERE v.product_id = OLD.id)
                ) THEN
                    RAISE EXCEPTION 'Remove values before category change'
                    USING ERRCODE = '23514';
                END IF;
            END IF;
            IF TG_TABLE_NAME = 'catalog_productimage' THEN
                IF (NEW.storage_key,NEW.content_type,NEW.size)
                   IS DISTINCT FROM (OLD.storage_key,OLD.content_type,OLD.size) THEN
                    RAISE EXCEPTION 'Image evidence is immutable' USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END; $$;
        CREATE TRIGGER catalog_variant_identity BEFORE UPDATE ON catalog_productvariant
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_attribute_identity BEFORE UPDATE ON catalog_attribute
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_option_identity BEFORE UPDATE ON catalog_attributeoption
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_image_identity BEFORE UPDATE ON catalog_productimage
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_product_value_identity BEFORE UPDATE ON catalog_productattributevalue
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_variant_value_identity BEFORE UPDATE ON catalog_variantattributevalue
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_category_link_identity BEFORE UPDATE ON catalog_categoryattribute
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        CREATE TRIGGER catalog_product_category_identity BEFORE UPDATE ON catalog_product
        FOR EACH ROW EXECUTE FUNCTION catalog_preserve_identity();
        """,
            reverse_sql="""
        DROP TRIGGER catalog_variant_identity ON catalog_productvariant;
        DROP TRIGGER catalog_attribute_identity ON catalog_attribute;
        DROP TRIGGER catalog_option_identity ON catalog_attributeoption;
        DROP TRIGGER catalog_image_identity ON catalog_productimage;
        DROP TRIGGER catalog_product_value_identity ON catalog_productattributevalue;
        DROP TRIGGER catalog_variant_value_identity ON catalog_variantattributevalue;
        DROP TRIGGER catalog_category_link_identity ON catalog_categoryattribute;
        DROP TRIGGER catalog_product_category_identity ON catalog_product;
        DROP FUNCTION catalog_preserve_identity();
        DROP TRIGGER catalog_history_immutable ON catalog_productstatushistory;
        DROP TRIGGER catalog_product_tenant ON catalog_product;
        DROP TRIGGER catalog_variant_tenant ON catalog_productvariant;
        DROP TRIGGER catalog_image_tenant ON catalog_productimage;
        DROP TRIGGER catalog_product_value_tenant ON catalog_productattributevalue;
        DROP TRIGGER catalog_variant_value_tenant ON catalog_variantattributevalue;
        DROP TRIGGER catalog_variant_scope ON catalog_productvariant;
        DROP TRIGGER catalog_image_scope ON catalog_productimage;
        DROP TRIGGER catalog_product_value_scope ON catalog_productattributevalue;
        DROP TRIGGER catalog_variant_value_scope ON catalog_variantattributevalue;
        DROP TRIGGER catalog_history_scope ON catalog_productstatushistory;
        DROP FUNCTION catalog_check_child_scope();
        DROP TRIGGER catalog_category_tree ON catalog_category;
        DROP FUNCTION catalog_check_category_tree();
        """,
        )
    ]
