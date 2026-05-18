import os
from dotenv import load_dotenv
from django.contrib.auth.hashers import make_password

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


# ─── Setup Path ─────────────────────────────────────────────

base_dir = os.path.dirname(os.path.abspath(__file__))

dotenv_path = os.path.abspath(
    os.path.join(base_dir, '..', '..', '.env')
)

load_dotenv(dotenv_path)


# ─── PostgreSQL Connection ──────────────────────────────────

def get_pg_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ─── Create Admin ───────────────────────────────────────────

def migrate_admin():

    print("\n" + "=" * 60)
    print("  MIGRATE ADMIN ACCOUNT")
    print("=" * 60)

    if not HAS_PSYCOPG2:
        print("  psycopg2 belum terinstall")
        return

    try:
        conn = get_pg_conn()
        cur = conn.cursor()

        print("  PostgreSQL terhubung")

    except Exception as e:
        print(f"  Gagal koneksi PostgreSQL: {e}")
        return

    try:

        email = "adminGanteng@gmail.com"

        # cek apakah admin sudah ada
        cur.execute(
            """
            SELECT id
            FROM accounts_user
            WHERE email = %s;
            """,
            (email,)
        )

        existing = cur.fetchone()

        if existing:
            print("  Admin sudah ada")
            return

        hashed_password = make_password("HiGanteng")

        cur.execute(
            """
            INSERT INTO accounts_user (
                password,
                last_login,
                is_superuser,
                username,
                first_name,
                last_name,
                is_staff,
                is_active,
                date_joined,
                email,
                role
            )
            VALUES (
                %s,
                NULL,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                NOW(),
                %s,
                %s
            );
            """,
            (
                hashed_password,
                True,
                "admin",
                "Admin",
                "",
                True,
                True,
                email,
                "admin"
            )
        )

        conn.commit()

        print("  Admin berhasil dibuat")
        print(f"  Email    : {email}")
        print(f"  Password : HiGanteng")

    except Exception as e:
        conn.rollback()
        print(f"  ERROR: {e}")
        raise

    finally:
        cur.close()
        conn.close()


# ─── Main ───────────────────────────────────────────────────

def main():

    print("\n" + "=" * 60)
    print("  MIGRATE ADMIN -- MULAI")
    print("=" * 60)

    migrate_admin()

    print("\n" + "=" * 60)
    print("  MIGRATE ADMIN -- SELESAI")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()