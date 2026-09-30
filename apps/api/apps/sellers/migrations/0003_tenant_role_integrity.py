from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("sellers", "0002_seed_roles")]
    operations = [
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION sellers_check_membership_scope() RETURNS trigger
                LANGUAGE plpgsql AS $$
                DECLARE role_seller uuid;
                BEGIN
                    IF TG_OP = 'UPDATE' THEN
                        IF NEW.seller_id IS DISTINCT FROM OLD.seller_id
                           OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
                            RAISE EXCEPTION 'Membership identity is immutable'
                                USING ERRCODE = '23514';
                        END IF;
                    END IF;
                    SELECT seller_id INTO role_seller FROM sellers_sellerrole
                        WHERE id = NEW.role_id FOR KEY SHARE;
                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Membership role must exist' USING ERRCODE = '23503';
                    END IF;
                    IF role_seller IS NOT NULL AND role_seller <> NEW.seller_id THEN
                        RAISE EXCEPTION 'Membership role belongs to another seller'
                            USING ERRCODE = '23514';
                    END IF;
                    RETURN NEW;
                END;
                $$;
                CREATE TRIGGER seller_membership_scope
                    BEFORE INSERT OR UPDATE ON sellers_sellermembership
                    FOR EACH ROW EXECUTE FUNCTION sellers_check_membership_scope();

                CREATE FUNCTION sellers_reject_role_identity_mutation() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    IF NEW.seller_id IS DISTINCT FROM OLD.seller_id
                       OR NEW.is_system IS DISTINCT FROM OLD.is_system
                       OR NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
                        RAISE EXCEPTION 'Role identity is immutable' USING ERRCODE = '23514';
                    END IF;
                    RETURN NEW;
                END;
                $$;
                CREATE TRIGGER seller_role_identity
                    BEFORE UPDATE ON sellers_sellerrole
                    FOR EACH ROW EXECUTE FUNCTION sellers_reject_role_identity_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER seller_role_identity ON sellers_sellerrole;
                DROP FUNCTION sellers_reject_role_identity_mutation();
                DROP TRIGGER seller_membership_scope ON sellers_sellermembership;
                DROP FUNCTION sellers_check_membership_scope();
            """,
        ),
    ]
