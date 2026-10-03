from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("payments", "0001_initial")]
    operations = [
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION payments_reject_transaction_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Payment transactions are append-only' USING ERRCODE = '55000';
        END; $$;
        CREATE TRIGGER payments_transaction_immutable
        BEFORE UPDATE OR DELETE ON payments_paymenttransaction
        FOR EACH ROW EXECUTE FUNCTION payments_reject_transaction_mutation();
        """,
            reverse_sql="""
        DROP TRIGGER payments_transaction_immutable ON payments_paymenttransaction;
        DROP FUNCTION payments_reject_transaction_mutation();
        """,
        )
    ]
