"""Package the toolkit assets using their checked-in Unity GUIDs."""
import gzip
import io
import re
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package = root / "emotiondriven.unitypackage"
prefix = "Assets/EmotionDriven"
root_meta = (root / "Editor.meta").read_bytes()
root_meta = re.sub(rb"guid: \w+", b"guid: 3c463816b1e6137428e0008d9e589099", root_meta)
entries = [("", None, root_meta)]
for folder in ("Editor", "Runtime", "Plugins", "Prefabs"):
    directory = root / folder
    for path in [directory, *sorted(directory.rglob("*"))]:
        if path.suffix == ".meta" or path.name.startswith("."):
            continue
        meta = Path(str(path) + ".meta").read_bytes()
        entries.append((path.relative_to(root).as_posix(), path if path.is_file() else None, meta))

with package.with_suffix(".tmp").open("wb") as raw:
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
        with tarfile.open(mode="w|", fileobj=compressed) as archive:
            for relative, path, meta in entries:
                guid = re.search(rb"^guid: ([0-9a-f]{32})$", meta, re.MULTILINE).group(1).decode()
                directory = tarfile.TarInfo(guid + "/")
                directory.type = tarfile.DIRTYPE
                directory.mode = 0o755
                archive.addfile(directory)
                assets = {"pathname": (prefix + ("/" + relative if relative else "")).encode(), "asset.meta": meta}
                if path:
                    assets["asset"] = path.read_bytes()
                for name, data in assets.items():
                    info = tarfile.TarInfo(f"{guid}/{name}")
                    info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
package.with_suffix(".tmp").replace(package)
