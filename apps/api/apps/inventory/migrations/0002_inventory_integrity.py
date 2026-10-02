from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        ("catalog", "0002_catalog_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION inventory_check_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            warehouse_seller uuid;
            variant_seller uuid;
        BEGIN
            SELECT seller_id INTO warehouse_seller
            FROM inventory_warehouse WHERE id = NEW.warehouse_id FOR KEY SHARE;

            SELECT p.seller_id INTO variant_seller
            FROM catalog_productvariant v
            JOIN catalog_product p ON p.id = v.product_id
            WHERE v.id = NEW.variant_id FOR KEY SHARE;

            IF warehouse_seller IS DISTINCT FROM variant_seller THEN
                RAISE EXCEPTION 'Inventory warehouse and variant must belong to the same seller'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER inventory_scope_check BEFORE INSERT OR UPDATE ON inventory_inventory
        FOR EACH ROW EXECUTE FUNCTION inventory_check_scope();

        CREATE FUNCTION inventory_preserve_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF (NEW.warehouse_id, NEW.variant_id)
                IS DISTINCT FROM (OLD.warehouse_id, OLD.variant_id) THEN
                RAISE EXCEPTION 'Inventory warehouse and variant identity is immutable'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER inventory_identity_check BEFORE UPDATE ON inventory_inventory
        FOR EACH ROW EXECUTE FUNCTION inventory_preserve_identity();

        CREATE FUNCTION warehouse_preserve_code() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.code IS DISTINCT FROM OLD.code THEN
                RAISE EXCEPTION 'Warehouse code is immutable' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER warehouse_code_check BEFORE UPDATE ON inventory_warehouse
        FOR EACH ROW EXECUTE FUNCTION warehouse_preserve_code();

        CREATE TRIGGER inventory_warehouse_tenant BEFORE UPDATE ON inventory_warehouse
        FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();

        CREATE TRIGGER inventory_transaction_immutable
        BEFORE UPDATE OR DELETE ON inventory_inventorytransaction
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS inventory_transaction_immutable ON inventory_inventorytransaction;
        DROP TRIGGER IF EXISTS inventory_warehouse_tenant ON inventory_warehouse;
        DROP TRIGGER IF EXISTS warehouse_code_check ON inventory_warehouse;
        DROP FUNCTION IF EXISTS warehouse_preserve_code();
        DROP TRIGGER IF EXISTS inventory_identity_check ON inventory_inventory;
        DROP FUNCTION IF EXISTS inventory_preserve_identity();
        DROP TRIGGER IF EXISTS inventory_scope_check ON inventory_inventory;
        DROP FUNCTION IF EXISTS inventory_check_scope();
            """,
        ),
    ]
