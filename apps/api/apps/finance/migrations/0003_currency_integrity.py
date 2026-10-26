from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_finance_integrity"),
    ]

    operations = [
        # Do not relabel or backfill historical balances/ledgers. Existing inconsistencies
        # remain visible for explicit reconciliation; new writes must obey the contract.
        migrations.RunSQL(
            sql="""
            CREATE FUNCTION finance_check_currency() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE
                seller_currency text;
                balance_currency text;
                source_currency text;
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    IF (NEW.seller_id, NEW.currency)
                        IS DISTINCT FROM (OLD.seller_id, OLD.currency) THEN
                        RAISE EXCEPTION 'Financial seller and currency are immutable'
                            USING ERRCODE = '23514';
                    END IF;
                END IF;

                SELECT default_currency INTO seller_currency FROM sellers_seller
                    WHERE id = NEW.seller_id FOR SHARE;
                IF NEW.currency IS DISTINCT FROM seller_currency THEN
                    RAISE EXCEPTION 'Financial currency must match seller currency'
                        USING ERRCODE = '23514';
                END IF;

                IF TG_TABLE_NAME = 'finance_sellerbalance' THEN
                    RETURN NEW;
                END IF;

                SELECT currency INTO balance_currency FROM finance_sellerbalance
                    WHERE seller_id = NEW.seller_id;
                IF FOUND AND NEW.currency IS DISTINCT FROM balance_currency THEN
                    RAISE EXCEPTION 'Financial currency must match seller balance currency'
                        USING ERRCODE = '23514';
                END IF;

                IF TG_TABLE_NAME = 'finance_sellerledgerentry' THEN
                    IF NEW.seller_order_id IS NOT NULL THEN
                        SELECT o.currency INTO source_currency FROM orders_order o
                            JOIN orders_sellerorder so ON so.order_id = o.id
                            WHERE so.id = NEW.seller_order_id;
                        IF NEW.currency IS DISTINCT FROM source_currency THEN
                            RAISE EXCEPTION 'Ledger currency must match order currency'
                                USING ERRCODE = '23514';
                        END IF;
                    END IF;
                    IF NEW.payout_id IS NOT NULL THEN
                        SELECT currency INTO source_currency FROM finance_payout
                            WHERE id = NEW.payout_id;
                        IF NEW.currency IS DISTINCT FROM source_currency THEN
                            RAISE EXCEPTION 'Ledger currency must match payout currency'
                                USING ERRCODE = '23514';
                        END IF;
                    END IF;
                END IF;
                RETURN NEW;
            END; $$;

            CREATE TRIGGER finance_balance_currency_check
                BEFORE INSERT OR UPDATE ON finance_sellerbalance
                FOR EACH ROW EXECUTE FUNCTION finance_check_currency();
            CREATE TRIGGER finance_payout_currency_check BEFORE INSERT OR UPDATE ON finance_payout
                FOR EACH ROW EXECUTE FUNCTION finance_check_currency();
            CREATE TRIGGER finance_ledger_currency_check
                BEFORE INSERT OR UPDATE ON finance_sellerledgerentry
                FOR EACH ROW EXECUTE FUNCTION finance_check_currency();

            CREATE FUNCTION finance_preserve_order_currency() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.currency IS DISTINCT FROM OLD.currency THEN
                    RAISE EXCEPTION 'Order currency is immutable' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END; $$;
            CREATE TRIGGER finance_order_currency_check BEFORE UPDATE ON orders_order
                FOR EACH ROW EXECUTE FUNCTION finance_preserve_order_currency();

            CREATE FUNCTION finance_preserve_seller_currency()
                RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.default_currency IS DISTINCT FROM OLD.default_currency AND (
                    EXISTS (SELECT 1 FROM finance_sellerbalance WHERE seller_id = OLD.id) OR
                    EXISTS (SELECT 1 FROM finance_sellerledgerentry WHERE seller_id = OLD.id) OR
                    EXISTS (SELECT 1 FROM finance_payout WHERE seller_id = OLD.id) OR
                    EXISTS (SELECT 1 FROM orders_sellerorder WHERE seller_id = OLD.id)
                ) THEN
                    RAISE EXCEPTION 'Seller currency cannot change after financial activity'
                        USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END; $$;
            CREATE TRIGGER finance_seller_currency_check BEFORE UPDATE ON sellers_seller
                FOR EACH ROW EXECUTE FUNCTION finance_preserve_seller_currency();
            """,
            reverse_sql="""
            DROP TRIGGER finance_seller_currency_check ON sellers_seller;
            DROP FUNCTION finance_preserve_seller_currency();
            DROP TRIGGER finance_order_currency_check ON orders_order;
            DROP FUNCTION finance_preserve_order_currency();
            DROP TRIGGER finance_ledger_currency_check ON finance_sellerledgerentry;
            DROP TRIGGER finance_payout_currency_check ON finance_payout;
            DROP TRIGGER finance_balance_currency_check ON finance_sellerbalance;
            DROP FUNCTION finance_check_currency();
            """,
        ),
    ]
