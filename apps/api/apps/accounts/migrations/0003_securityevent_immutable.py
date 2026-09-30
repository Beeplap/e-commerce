from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_securityevent")]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION accounts_reject_security_event_mutation() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Security events are append-only' USING ERRCODE = '55000';
                END;
                $$;
                CREATE TRIGGER security_event_immutable
                BEFORE UPDATE OR DELETE ON accounts_securityevent
                FOR EACH ROW EXECUTE FUNCTION accounts_reject_security_event_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER security_event_immutable ON accounts_securityevent;
                DROP FUNCTION accounts_reject_security_event_mutation();
            """,
        ),
    ]
