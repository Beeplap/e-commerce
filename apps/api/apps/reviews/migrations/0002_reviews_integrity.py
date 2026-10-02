from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0001_initial"),
        ("catalog", "0002_catalog_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
        -- ReviewModeration is append-only
        CREATE FUNCTION reviews_reject_moderation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Review moderation records are append-only' USING ERRCODE = '55000';
        END; $$;

        CREATE TRIGGER reviews_moderation_immutable
        BEFORE UPDATE OR DELETE ON reviews_reviewmoderation
        FOR EACH ROW EXECUTE FUNCTION reviews_reject_moderation_mutation();

        -- ProductReview identity integrity
        CREATE FUNCTION reviews_review_check() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.id, NEW.customer_id, NEW.product_id)
                    IS DISTINCT FROM (OLD.id, OLD.customer_id, OLD.product_id) THEN
                    RAISE EXCEPTION 'Review identity, customer, and product are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER reviews_review_integrity
        BEFORE UPDATE ON reviews_productreview
        FOR EACH ROW EXECUTE FUNCTION reviews_review_check();

        -- SellerReviewResponse tenant scope matching
        CREATE FUNCTION reviews_seller_response_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            prod_seller uuid;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.id, NEW.review_id, NEW.seller_id)
                    IS DISTINCT FROM (OLD.id, OLD.review_id, OLD.seller_id) THEN
                    RAISE EXCEPTION 'Review response identity, review, and seller are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            SELECT p.seller_id INTO prod_seller
            FROM reviews_productreview r
            JOIN catalog_product p ON p.id = r.product_id
            WHERE r.id = NEW.review_id FOR KEY SHARE;

            IF prod_seller IS DISTINCT FROM NEW.seller_id THEN
                RAISE EXCEPTION 'Seller response must belong to the product seller'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER reviews_seller_response_integrity
        BEFORE INSERT OR UPDATE ON reviews_sellerreviewresponse
        FOR EACH ROW EXECUTE FUNCTION reviews_seller_response_check();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS reviews_seller_response_integrity ON reviews_sellerreviewresponse;
        DROP FUNCTION IF EXISTS reviews_seller_response_check();
        DROP TRIGGER IF EXISTS reviews_review_integrity ON reviews_productreview;
        DROP FUNCTION IF EXISTS reviews_review_check();
        DROP TRIGGER IF EXISTS reviews_moderation_immutable ON reviews_reviewmoderation;
        DROP FUNCTION IF EXISTS reviews_reject_moderation_mutation();
            """,
        )
    ]
