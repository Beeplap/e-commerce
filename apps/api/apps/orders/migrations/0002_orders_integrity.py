from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0001_initial"),
        ("inventory", "0002_inventory_integrity"),
        ("catalog", "0002_catalog_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION order_item_check_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            so_seller uuid;
            p_seller uuid;
            v_seller uuid;
            w_seller uuid;
        BEGIN
            SELECT seller_id INTO so_seller
            FROM orders_sellerorder WHERE id = NEW.seller_order_id FOR KEY SHARE;

            IF NEW.product_id IS NOT NULL THEN
                SELECT seller_id INTO p_seller
                FROM catalog_product WHERE id = NEW.product_id FOR KEY SHARE;
                IF p_seller IS DISTINCT FROM so_seller THEN
                    RAISE EXCEPTION
                        'OrderItem product must belong to the same seller as SellerOrder'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            IF NEW.variant_id IS NOT NULL THEN
                SELECT p.seller_id INTO v_seller
                FROM catalog_productvariant v
                JOIN catalog_product p ON p.id = v.product_id
                WHERE v.id = NEW.variant_id FOR KEY SHARE;
                IF v_seller IS DISTINCT FROM so_seller THEN
                    RAISE EXCEPTION
                        'OrderItem variant must belong to the same seller as SellerOrder'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            IF NEW.warehouse_id IS NOT NULL THEN
                SELECT seller_id INTO w_seller
                FROM inventory_warehouse WHERE id = NEW.warehouse_id FOR KEY SHARE;
                IF w_seller IS DISTINCT FROM so_seller THEN
                    RAISE EXCEPTION
                        'OrderItem warehouse must belong to the same seller as SellerOrder'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER order_item_scope_check BEFORE INSERT OR UPDATE ON orders_orderitem
        FOR EACH ROW EXECUTE FUNCTION order_item_check_scope();

        CREATE FUNCTION seller_order_preserve_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF (NEW.seller_id, NEW.order_id, NEW.seller_order_number)
                IS DISTINCT FROM (OLD.seller_id, OLD.order_id, OLD.seller_order_number) THEN
                RAISE EXCEPTION 'SellerOrder seller, order, and seller_order_number are immutable'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER seller_order_identity_check BEFORE UPDATE ON orders_sellerorder
        FOR EACH ROW EXECUTE FUNCTION seller_order_preserve_identity();

        CREATE FUNCTION order_preserve_order_number() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.order_number IS DISTINCT FROM OLD.order_number THEN
                RAISE EXCEPTION 'Order order_number is immutable' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END; $$;

        CREATE TRIGGER order_number_check BEFORE UPDATE ON orders_order
        FOR EACH ROW EXECUTE FUNCTION order_preserve_order_number();

        CREATE TRIGGER order_status_history_immutable
        BEFORE UPDATE OR DELETE ON orders_orderstatushistory
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

        CREATE TRIGGER order_item_immutable
        BEFORE UPDATE OR DELETE ON orders_orderitem
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS order_item_immutable ON orders_orderitem;
        DROP TRIGGER IF EXISTS order_status_history_immutable ON orders_orderstatushistory;
        DROP TRIGGER IF EXISTS order_number_check ON orders_order;
        DROP FUNCTION IF EXISTS order_preserve_order_number();
        DROP TRIGGER IF EXISTS seller_order_identity_check ON orders_sellerorder;
        DROP FUNCTION IF EXISTS seller_order_preserve_identity();
        DROP TRIGGER IF EXISTS order_item_scope_check ON orders_orderitem;
        DROP FUNCTION IF EXISTS order_item_check_scope();
            """,
        ),
    ]
