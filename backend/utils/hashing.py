import hashlib

def route_hash(points, stride=10):
    """
    Create a stable hash from lat/lon coordinates (downsampled for brevity).
    """
    m = hashlib.sha1()
    for i, (lat, lon, ele) in enumerate(points):
        if i % stride: continue
        m.update(f"{lat:.6f},{lon:.6f};".encode())
    return m.hexdigest()
