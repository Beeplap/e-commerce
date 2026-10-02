from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("promotions", "0001_initial"),
        ("catalog", "0002_catalog_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
        -- CouponUsage is append-only
        CREATE FUNCTION promotions_reject_usage_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Coupon usage records are append-only' USING ERRCODE = '55000';
        END; $$;

        CREATE TRIGGER promotions_coupon_usage_immutable
        BEFORE UPDATE OR DELETE ON promotions_couponusage
        FOR EACH ROW EXECUTE FUNCTION promotions_reject_usage_mutation();

        -- Promotion identity integrity
        CREATE FUNCTION promotions_promotion_check() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.id, NEW.scope, NEW.seller_id)
                    IS DISTINCT FROM (OLD.id, OLD.scope, OLD.seller_id) THEN
                    RAISE EXCEPTION 'Promotion identity, scope, and seller are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER promotions_promotion_integrity
        BEFORE UPDATE ON promotions_promotion
        FOR EACH ROW EXECUTE FUNCTION promotions_promotion_check();

        -- PromotionProduct tenant matching
        CREATE FUNCTION promotions_product_scope_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            promo_scope varchar(16);
            promo_seller uuid;
            prod_seller uuid;
        BEGIN
            SELECT scope, seller_id INTO promo_scope, promo_seller
            FROM promotions_promotion WHERE id = NEW.promotion_id FOR KEY SHARE;

            IF promo_scope = 'seller' THEN
                SELECT seller_id INTO prod_seller
                FROM catalog_product WHERE id = NEW.product_id FOR KEY SHARE;

                IF prod_seller IS DISTINCT FROM promo_seller THEN
                    RAISE EXCEPTION 'Targeted product must belong to the promotion seller'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER promotions_product_scope_integrity
        BEFORE INSERT OR UPDATE ON promotions_promotionproduct
        FOR EACH ROW EXECUTE FUNCTION promotions_product_scope_check();

        -- PromotionSeller must belong to platform promotion
        CREATE FUNCTION promotions_seller_target_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            promo_scope varchar(16);
        BEGIN
            SELECT scope INTO promo_scope
            FROM promotions_promotion WHERE id = NEW.promotion_id FOR KEY SHARE;

            IF promo_scope <> 'platform' THEN
                RAISE EXCEPTION 'Only platform promotions can specify targeted sellers'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER promotions_seller_target_integrity
        BEFORE INSERT OR UPDATE ON promotions_promotionseller
        FOR EACH ROW EXECUTE FUNCTION promotions_seller_target_check();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS promotions_seller_target_integrity ON promotions_promotionseller;
        DROP FUNCTION IF EXISTS promotions_seller_target_check();
        DROP TRIGGER IF EXISTS promotions_product_scope_integrity ON promotions_promotionproduct;
        DROP FUNCTION IF EXISTS promotions_product_scope_check();
        DROP TRIGGER IF EXISTS promotions_promotion_integrity ON promotions_promotion;
        DROP FUNCTION IF EXISTS promotions_promotion_check();
        DROP TRIGGER IF EXISTS promotions_coupon_usage_immutable ON promotions_couponusage;
        DROP FUNCTION IF EXISTS promotions_reject_usage_mutation();
            """,
        )
    ]
