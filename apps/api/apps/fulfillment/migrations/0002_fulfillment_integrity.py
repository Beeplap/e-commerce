from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("fulfillment", "0001_initial"),
        ("orders", "0002_orders_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
        -- Immutability triggers for append-only tables
        CREATE TRIGGER fulfillment_return_history_immutable
        BEFORE UPDATE OR DELETE ON fulfillment_returnstatushistory
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

        CREATE TRIGGER fulfillment_tracking_event_immutable
        BEFORE UPDATE OR DELETE ON fulfillment_trackingevent
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

        CREATE TRIGGER fulfillment_refund_transaction_immutable
        BEFORE UPDATE OR DELETE ON fulfillment_refundtransaction
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

        -- Shipment tenant scope & identity preservation
        CREATE FUNCTION fulfillment_shipment_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_seller uuid;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.seller_id, NEW.seller_order_id, NEW.shipment_number)
                    IS DISTINCT FROM (OLD.seller_id, OLD.seller_order_id, OLD.shipment_number) THEN
                    RAISE EXCEPTION
                        'Shipment seller, seller_order, and shipment_number are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            SELECT seller_id INTO target_seller
            FROM orders_sellerorder WHERE id = NEW.seller_order_id FOR KEY SHARE;
            IF target_seller IS DISTINCT FROM NEW.seller_id THEN
                RAISE EXCEPTION 'Shipment seller must match seller_order seller'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER fulfillment_shipment_integrity
        BEFORE INSERT OR UPDATE ON fulfillment_shipment
        FOR EACH ROW EXECUTE FUNCTION fulfillment_shipment_check();

        -- ShipmentItem cross-tenant scope check
        CREATE FUNCTION fulfillment_shipment_item_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_order uuid;
            item_order uuid;
        BEGIN
            SELECT seller_order_id INTO target_order
            FROM fulfillment_shipment WHERE id = NEW.shipment_id FOR KEY SHARE;

            SELECT seller_order_id INTO item_order
            FROM orders_orderitem WHERE id = NEW.order_item_id FOR KEY SHARE;

            IF target_order IS DISTINCT FROM item_order THEN
                RAISE EXCEPTION
                    'ShipmentItem order_item must belong to the same seller_order as Shipment'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER fulfillment_shipment_item_integrity
        BEFORE INSERT OR UPDATE ON fulfillment_shipmentitem
        FOR EACH ROW EXECUTE FUNCTION fulfillment_shipment_item_check();

        -- ReturnRequest tenant scope & identity preservation
        CREATE FUNCTION fulfillment_return_request_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_seller uuid;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.seller_id, NEW.seller_order_id, NEW.return_number)
                    IS DISTINCT FROM (OLD.seller_id, OLD.seller_order_id, OLD.return_number) THEN
                    RAISE EXCEPTION
                        'ReturnRequest seller, seller_order, and return_number are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            SELECT seller_id INTO target_seller
            FROM orders_sellerorder WHERE id = NEW.seller_order_id FOR KEY SHARE;
            IF target_seller IS DISTINCT FROM NEW.seller_id THEN
                RAISE EXCEPTION 'ReturnRequest seller must match seller_order seller'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER fulfillment_return_request_integrity
        BEFORE INSERT OR UPDATE ON fulfillment_returnrequest
        FOR EACH ROW EXECUTE FUNCTION fulfillment_return_request_check();

        -- ReturnItem cross-tenant scope check
        CREATE FUNCTION fulfillment_return_item_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_order uuid;
            item_order uuid;
        BEGIN
            SELECT seller_order_id INTO target_order
            FROM fulfillment_returnrequest WHERE id = NEW.return_request_id FOR KEY SHARE;

            SELECT seller_order_id INTO item_order
            FROM orders_orderitem WHERE id = NEW.order_item_id FOR KEY SHARE;

            IF target_order IS DISTINCT FROM item_order THEN
                RAISE EXCEPTION
                    'ReturnItem order_item must belong to the same seller_order as ReturnRequest'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER fulfillment_return_item_integrity
        BEFORE INSERT OR UPDATE ON fulfillment_returnitem
        FOR EACH ROW EXECUTE FUNCTION fulfillment_return_item_check();

        -- Refund tenant scope, identity preservation, and immutability
        CREATE FUNCTION fulfillment_refund_check() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_seller uuid;
            return_seller uuid;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF (NEW.seller_id, NEW.seller_order_id, NEW.refund_number)
                    IS DISTINCT FROM (OLD.seller_id, OLD.seller_order_id, OLD.refund_number) THEN
                    RAISE EXCEPTION 'Refund seller, seller_order, and refund_number are immutable'
                        USING ERRCODE = '23514';
                END IF;

                IF OLD.status = 'completed'
                    AND (NEW.status IS DISTINCT FROM OLD.status
                         OR NEW.amount IS DISTINCT FROM OLD.amount
                         OR NEW.seller_deduction IS DISTINCT FROM OLD.seller_deduction) THEN
                    RAISE EXCEPTION 'Completed refund cannot be modified'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            SELECT seller_id INTO target_seller
            FROM orders_sellerorder WHERE id = NEW.seller_order_id FOR KEY SHARE;
            IF target_seller IS DISTINCT FROM NEW.seller_id THEN
                RAISE EXCEPTION 'Refund seller must match seller_order seller'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.return_request_id IS NOT NULL THEN
                SELECT seller_id INTO return_seller
                FROM fulfillment_returnrequest WHERE id = NEW.return_request_id FOR KEY SHARE;
                IF return_seller IS DISTINCT FROM NEW.seller_id THEN
                    RAISE EXCEPTION 'Refund return_request must belong to the same seller'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER fulfillment_refund_integrity
        BEFORE INSERT OR UPDATE ON fulfillment_refund
        FOR EACH ROW EXECUTE FUNCTION fulfillment_refund_check();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS fulfillment_refund_integrity ON fulfillment_refund;
        DROP FUNCTION IF EXISTS fulfillment_refund_check();

        DROP TRIGGER IF EXISTS fulfillment_return_item_integrity ON fulfillment_returnitem;
        DROP FUNCTION IF EXISTS fulfillment_return_item_check();

        DROP TRIGGER IF EXISTS fulfillment_return_request_integrity ON fulfillment_returnrequest;
        DROP FUNCTION IF EXISTS fulfillment_return_request_check();

        DROP TRIGGER IF EXISTS fulfillment_shipment_item_integrity ON fulfillment_shipmentitem;
        DROP FUNCTION IF EXISTS fulfillment_shipment_item_check();

        DROP TRIGGER IF EXISTS fulfillment_shipment_integrity ON fulfillment_shipment;
        DROP FUNCTION IF EXISTS fulfillment_shipment_check();

        DROP TRIGGER IF EXISTS fulfillment_refund_transaction_immutable
            ON fulfillment_refundtransaction;
        DROP TRIGGER IF EXISTS fulfillment_tracking_event_immutable ON fulfillment_trackingevent;
        DROP TRIGGER IF EXISTS fulfillment_return_history_immutable
            ON fulfillment_returnstatushistory;
            """,
        ),
    ]
