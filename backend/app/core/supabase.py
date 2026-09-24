from supabase import create_client, Client
from app.core.config import settings

supabase_client: Client | None = None


def get_supabase_client() -> Client | None:
    global supabase_client
    if supabase_client is None:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            except Exception as e:
                print(f"[Supabase] Koneksi gagal: {e}")
    return supabase_client
