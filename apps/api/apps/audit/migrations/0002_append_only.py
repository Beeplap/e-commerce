from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]
    operations = [
        migrations.RunSQL(
            sql="""
        CREATE FUNCTION audit_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE = '55000';
        END; $$;
        CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_auditlog
        FOR EACH ROW EXECUTE FUNCTION audit_reject_mutation();
        """,
            reverse_sql="""
        DROP TRIGGER audit_log_immutable ON audit_auditlog;
        DROP FUNCTION audit_reject_mutation();
        """,
        )
    ]
