from decimal import Decimal

from django.db import migrations


def seed_finance_data(apps, schema_editor):
    CommissionPlan = apps.get_model("finance", "CommissionPlan")
    Seller = apps.get_model("sellers", "Seller")
    SellerBalance = apps.get_model("finance", "SellerBalance")
    db = schema_editor.connection.alias

    CommissionPlan.objects.using(db).get_or_create(
        is_default=True,
        defaults={
            "name": "Standard Marketplace Plan",
            "description": "Default marketplace commission plan",
            "default_percentage": Decimal("10.00"),
            "is_active": True,
        },
    )

    for seller in Seller.objects.using(db).all():
        SellerBalance.objects.using(db).get_or_create(
            seller=seller,
            defaults={
                "currency": "USD",
                "current_balance": Decimal("0.00"),
                "pending_balance": Decimal("0.00"),
                "total_paid_out": Decimal("0.00"),
            },
        )


def reverse_finance_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
        ("orders", "0002_orders_integrity"),
        ("sellers", "0005_lifecycle_integrity"),
    ]

    operations = [
        migrations.RunPython(seed_finance_data, reverse_finance_data),
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION finance_ledger_check_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            target_seller uuid;
        BEGIN
            IF NEW.seller_order_id IS NOT NULL THEN
                SELECT seller_id INTO target_seller
                FROM orders_sellerorder WHERE id = NEW.seller_order_id FOR KEY SHARE;
                IF target_seller IS DISTINCT FROM NEW.seller_id THEN
                    RAISE EXCEPTION 'SellerLedgerEntry seller_order must belong to the same seller'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            IF NEW.payout_id IS NOT NULL THEN
                SELECT seller_id INTO target_seller
                FROM finance_payout WHERE id = NEW.payout_id FOR KEY SHARE;
                IF target_seller IS DISTINCT FROM NEW.seller_id THEN
                    RAISE EXCEPTION 'SellerLedgerEntry payout must belong to the same seller'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER finance_ledger_scope_check
        BEFORE INSERT OR UPDATE ON finance_sellerledgerentry
        FOR EACH ROW EXECUTE FUNCTION finance_ledger_check_scope();

        CREATE FUNCTION finance_payout_preserve_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF (NEW.seller_id, NEW.payout_number)
                IS DISTINCT FROM (OLD.seller_id, OLD.payout_number) THEN
                RAISE EXCEPTION 'Payout seller and payout_number are immutable'
                    USING ERRCODE = '23514';
            END IF;

            IF OLD.status = 'PROCESSED'
                AND (NEW.status IS DISTINCT FROM OLD.status
                     OR NEW.amount IS DISTINCT FROM OLD.amount) THEN
                RAISE EXCEPTION 'Processed payout cannot be modified'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER finance_payout_identity_check BEFORE UPDATE ON finance_payout
        FOR EACH ROW EXECUTE FUNCTION finance_payout_preserve_identity();

        CREATE FUNCTION finance_payout_item_check_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            p_seller uuid;
            l_seller uuid;
        BEGIN
            SELECT seller_id INTO p_seller
            FROM finance_payout WHERE id = NEW.payout_id FOR KEY SHARE;

            SELECT seller_id INTO l_seller
            FROM finance_sellerledgerentry WHERE id = NEW.ledger_entry_id FOR KEY SHARE;

            IF p_seller IS DISTINCT FROM l_seller THEN
                RAISE EXCEPTION 'PayoutItem ledger_entry must belong to the same seller as Payout'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NEW;
        END; $$;

        CREATE TRIGGER finance_payout_item_scope_check BEFORE INSERT OR UPDATE ON finance_payoutitem
        FOR EACH ROW EXECUTE FUNCTION finance_payout_item_check_scope();

        CREATE TRIGGER finance_ledger_immutable
        BEFORE UPDATE OR DELETE ON finance_sellerledgerentry
        FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();
            """,
            reverse_sql="""
        DROP TRIGGER IF EXISTS finance_ledger_immutable ON finance_sellerledgerentry;
        DROP TRIGGER IF EXISTS finance_payout_item_scope_check ON finance_payoutitem;
        DROP FUNCTION IF EXISTS finance_payout_item_check_scope();
        DROP TRIGGER IF EXISTS finance_payout_identity_check ON finance_payout;
        DROP FUNCTION IF EXISTS finance_payout_preserve_identity();
        DROP TRIGGER IF EXISTS finance_ledger_scope_check ON finance_sellerledgerentry;
        DROP FUNCTION IF EXISTS finance_ledger_check_scope();
            """,
        ),
    ]
