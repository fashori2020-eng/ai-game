#!/usr/bin/env python3
"""Build site data files from fawazahmed0/quran-api + risan/quran-json sources.

Inputs (downloaded beforehand, see README):
  /tmp/quran/ar.json        flat ayah list, Uthmani simple Arabic text
  /tmp/quran/fa.json        flat ayah list, Persian translation (Makarem Shirazi)
  /tmp/quran/chapters.json  surah metadata (risan/quran-json / tanzil)

Outputs:
  public/data/quran-meta.js   surah metadata + audio offsets (small, loads first)
  public/data/quran-full.js   Arabic + Persian text of all 6236 ayahs (loads async)
"""
import json
import os

SRC = "/tmp/quran"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")

ar = json.load(open(f"{SRC}/ar.json", encoding="utf-8"))["quran"]
fa = json.load(open(f"{SRC}/fa.json", encoding="utf-8"))["quran"]
chapters = json.load(open(f"{SRC}/chapters.json", encoding="utf-8"))["chapters"]

assert len(ar) == 6236 and len(fa) == 6236, (len(ar), len(fa))
assert len(chapters) == 114

surahs_ar = [[] for _ in range(115)]
surahs_fa = [[] for _ in range(115)]
for a in ar:
    surahs_ar[a["chapter"]].append(a)
for a in fa:
    surahs_fa[a["chapter"]].append(a)

for ch in chapters:
    n = ch["id"]
    for label, lst in (("ar", surahs_ar[n]), ("fa", surahs_fa[n])):
        assert len(lst) == ch["total_verses"], (n, label, len(lst), ch["total_verses"])
        for i, ay in enumerate(lst):
            assert ay["verse"] == i + 1, (n, label, ay["verse"], i + 1)

# Standard Persian short names of the 114 surahs (conventional mushaf names).
FA_NAMES = [
    "فاتحه", "بقره", "آل‌عمران", "نساء", "مائده", "انعام", "اعراف", "انفال", "توبه", "یونس",
    "هود", "یوسف", "رعد", "ابراهیم", "حجر", "نحل", "اسراء", "کهف", "مریم", "طه",
    "انبیاء", "حج", "مؤمنون", "نور", "فرقان", "شعراء", "نمل", "قصص", "عنکبوت", "روم",
    "لقمان", "سجده", "احزاب", "سبا", "فاطر", "یس", "صافات", "ص", "زمر", "غافر",
    "فصلت", "شوری", "زخرف", "دخان", "جاثیه", "احقاف", "محمد", "فتح", "حجرات", "ق",
    "ذاریات", "طور", "نجم", "قمر", "الرحمن", "واقعه", "حدید", "مجادله", "حشر", "ممتحنه",
    "صف", "جمعه", "منافقون", "تغابن", "طلاق", "تحریم", "ملک", "قلم", "حاقه", "معارج",
    "نوح", "جن", "مزمل", "مدثر", "قیامه", "انسان", "مرسلات", "نبأ", "نازعات", "عبس",
    "تکویر", "انفطار", "مطففین", "انشقاق", "بروج", "طارق", "اعلی", "غاشیه", "فجر", "بلد",
    "شمس", "لیل", "ضحی", "شرح", "تین", "علق", "قدر", "بینه", "زلزله", "عادیات",
    "قارعه", "تکاثر", "عصر", "همزه", "فیل", "قریش", "ماعون", "کوثر", "کافرون", "نصر",
    "مسد", "اخلاص", "فلق", "ناس",
]
assert len(FA_NAMES) == 114

meta_surahs = []
offsets = {}
g = 1
for ch in chapters:
    n = ch["id"]
    offsets[str(n)] = g
    g += ch["total_verses"]
    meta_surahs.append({
        "n": n,
        "fa": FA_NAMES[n - 1],
        "ar": ch["name"],
        "en": ch["transliteration"],
        "tr": ch["translation"],
        "t": "مکی" if ch["type"] == "meccan" else "مدنی",
        "a": ch["total_verses"],
    })

# This dataset embeds the Bismillah at the start of ayah 1 of every surah
# except 1 (where it *is* the first ayah) and 9 (which has none). The site
# renders the Bismillah as a decorative header, so strip the duplicated prefix.
# Derive the exact byte-sequence from the data itself (combining marks make a
# typed literal unreliable), then verify it really is the Bismillah.
import re as _re


def _strip_diac(s):
    return _re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06DF-\u06E8]", "", s)


_a2, _a112 = surahs_ar[2][0]["text"], surahs_ar[112][0]["text"]
_i = 0
while _i < min(len(_a2), len(_a112)) and _a2[_i] == _a112[_i]:
    _i += 1
BISMILLAH = _a2[:_i].rstrip(" ") + " "
assert _strip_diac(BISMILLAH).strip() == "بسم الله الرحمن الرحيم", repr(BISMILLAH)

full = {}
for n in range(1, 115):
    rows = []
    for i in range(len(surahs_ar[n])):
        ar_text = surahs_ar[n][i]["text"]
        if n not in (1, 9) and i == 0:
            assert ar_text.startswith(BISMILLAH), (n, repr(ar_text[:50]))
            ar_text = ar_text[len(BISMILLAH):].strip()
        rows.append([ar_text, surahs_fa[n][i]["text"]])
    full[str(n)] = rows

os.makedirs(OUT, exist_ok=True)
meta_js = (
    "window.QURAN_META="
    + json.dumps({"surahs": meta_surahs, "offsets": offsets, "totalAyahs": 6236},
                 ensure_ascii=False, separators=(",", ":"))
    + ";\n"
)
full_js = (
    "window.QURAN_FULL="
    + json.dumps(full, ensure_ascii=False, separators=(",", ":"))
    + ";\n"
)
open(os.path.join(OUT, "quran-meta.js"), "w", encoding="utf-8").write(meta_js)
open(os.path.join(OUT, "quran-full.js"), "w", encoding="utf-8").write(full_js)

print("meta bytes:", len(meta_js))
print("full bytes:", len(full_js))
print("surahs:", len(meta_surahs), "ayahs:", g - 1)
