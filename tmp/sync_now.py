import sys
import os

# Get path to backend directory (relative to this script's directory if needed, 
# but we know we're running from project root)
backend_path = os.path.join(os.getcwd(), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Mock some environment variables if needed
os.environ["TELEGRAF_CONF_PATH"] = os.path.join(os.getcwd(), "docker", "telegraf", "telegraf.conf")

try:
    from services.telegraf_sync import sync_telegraf_config
    print("Triggering Telegraf sync...")
    sync_telegraf_config()
    print("Sync complete.")
except Exception as e:
    print(f"Error triggering sync: {e}")
    sys.exit(1)
