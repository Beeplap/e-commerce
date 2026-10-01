from django.db import migrations


def backfill(apps, schema_editor):
    Seller = apps.get_model("sellers", "Seller")
    Profile = apps.get_model("sellers", "SellerProfile")
    Settings = apps.get_model("sellers", "SellerSettings")
    for seller in Seller.objects.using(schema_editor.connection.alias).iterator():
        Profile.objects.using(schema_editor.connection.alias).get_or_create(seller_id=seller.pk)
        Settings.objects.using(schema_editor.connection.alias).get_or_create(seller_id=seller.pk)


class Migration(migrations.Migration):
    dependencies = [("sellers", "0004_sellerprofile_sellersettings_selleraddress_and_more")]
    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RunSQL(
            sql="""
            CREATE FUNCTION sellers_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'Seller history is append-only' USING ERRCODE = '55000';
            END; $$;
            CREATE TRIGGER seller_history_immutable
            BEFORE UPDATE OR DELETE ON sellers_sellerstatushistory
            FOR EACH ROW EXECUTE FUNCTION sellers_reject_history_mutation();

            CREATE FUNCTION sellers_preserve_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.seller_id IS DISTINCT FROM OLD.seller_id
                   OR NEW.id IS DISTINCT FROM OLD.id THEN
                    RAISE EXCEPTION 'Tenant identity is immutable' USING ERRCODE = '23514';
                END IF;
                RETURN NEW;
            END; $$;
            CREATE TRIGGER seller_profile_tenant BEFORE UPDATE ON sellers_sellerprofile
            FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
            CREATE TRIGGER seller_settings_tenant BEFORE UPDATE ON sellers_sellersettings
            FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
            CREATE TRIGGER seller_address_tenant BEFORE UPDATE ON sellers_selleraddress
            FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();
            CREATE TRIGGER seller_document_tenant BEFORE UPDATE ON sellers_sellerdocument
            FOR EACH ROW EXECUTE FUNCTION sellers_preserve_tenant();

            CREATE FUNCTION sellers_preserve_document() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'Submitted documents cannot be deleted'
                    USING ERRCODE = '55000';
                END IF;
                IF OLD.status != 'pending' OR
                   (to_jsonb(NEW) - ARRAY[
                       'status','verified_by_id','verified_at','rejection_reason'])
                   IS DISTINCT FROM
                   (to_jsonb(OLD) - ARRAY[
                       'status','verified_by_id','verified_at','rejection_reason'])
                   THEN
                    RAISE EXCEPTION 'Document identity and completed reviews are immutable'
                    USING ERRCODE = '55000';
                END IF;
                RETURN NEW;
            END; $$;
            CREATE TRIGGER seller_document_immutable
            BEFORE UPDATE OR DELETE ON sellers_sellerdocument
            FOR EACH ROW EXECUTE FUNCTION sellers_preserve_document();
            """,
            reverse_sql="""
            DROP TRIGGER seller_document_immutable ON sellers_sellerdocument;
            DROP FUNCTION sellers_preserve_document();
            DROP TRIGGER seller_document_tenant ON sellers_sellerdocument;
            DROP TRIGGER seller_address_tenant ON sellers_selleraddress;
            DROP TRIGGER seller_settings_tenant ON sellers_sellersettings;
            DROP TRIGGER seller_profile_tenant ON sellers_sellerprofile;
            DROP FUNCTION sellers_preserve_tenant();
            DROP TRIGGER seller_history_immutable ON sellers_sellerstatushistory;
            DROP FUNCTION sellers_reject_history_mutation();
            """,
        ),
    ]
