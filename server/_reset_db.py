import os, time
db = os.path.join(os.path.dirname(__file__), 'nantang_fresh.db')
for i in range(3):
    try:
        os.remove(db)
        print('DB deleted')
        break
    except PermissionError:
        print(f'Attempt {i+1}: locked, retrying...')
        time.sleep(1)
else:
    print('FAILED: Please stop the server (Ctrl+C in server terminal) and re-run this script')
