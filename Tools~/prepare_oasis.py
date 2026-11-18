"""Rebuild the dashboard's aggregate data from the published OASIS long CSV."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

SOURCE_SHA256 = "146bdb9bb21d428344da8f59600565119e6c565613e6f5c6ba214449a31c75c2"
OUTPUT = Path(__file__).resolve().parent / "dashboard/oasis.js"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="OASIS_data_long.csv from https://osf.io/download/p8kcu/")
    path = parser.parse_args().csv_file
    with path.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != SOURCE_SHA256:
            raise ValueError("Expected the OASIS source revision documented in README.md")

    images = {}
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.reader(source)
        columns = next(reader)
        # The CSV has two columns called ID. The second identifies the stimulus.
        image_col = columns.index("ID", columns.index("ID") + 1)
        dimension, value, theme, category = map(columns.index, ("valar", "rating", "theme", "category"))
        for row in reader:
            if row[value] == "NA":
                continue
            image_id = row[image_col]
            image = images.setdefault(image_id, [image_id, row[theme], row[category], 0, 0, 0, 0])
            offset = {"Valence": 3, "Arousal": 5}[row[dimension]]
            rating = int(row[value])
            if not 1 <= rating <= 7:
                raise ValueError(f"Unexpected rating {rating}")
            image[offset] += rating
            image[offset + 1] += 1

    records = sorted(images.values(), key=lambda r: int(r[0][1:]))
    assert len(records) == 900 and all(r[4] and r[6] for r in records)
    lines = [json.dumps(record, ensure_ascii=True) for record in records]
    OUTPUT.write_text("// Derived by Tools~/prepare_oasis.py. Sums and counts retain the original 1–7 scale.\n"
                      + "const oasisRatings = [\n" + ",\n".join(lines) + "\n];\n", encoding="utf-8")
    print(f"{len(records)} images, {sum(r[4] + r[6] for r in records)} observed ratings")


if __name__ == "__main__":
    main()
