"""Marketplace search that finds what students mean, not just the exact words they type.

"shoes" should find a listing titled "Nike Air Max 270", "calculator" should find "Casio
fx-991EX", and "snekers" should still find sneakers. For each word in the search we look for:

  * the word itself and its singular/plural ("shoes" -> shoe, shoes),
  * related words from TOPICS below (shoes -> sneakers, footwear, Nike, Adidas, ...),
  * close spellings, to forgive typos (snekers -> sneakers),

in the title, description and category, as whole words (so "cap" doesn't match "capacitor";
what the student typed may also start a longer word, for searching while typing). Every word
in the search must match something ("red shoes" needs both).

TOPICS is hand-written: add to it when students search for something and miss.
"""

import difflib
import re

from sqlalchemy import case, func, or_

# Each topic: "same" words all mean the thing itself and find each other; "includes" are
# kinds and brands of it. Searching a "same" word also finds every "includes" word, but a
# brand only finds itself ("shoes" finds Nike, "nike" doesn't find Adidas).
TOPICS: dict[str, dict[str, list[str]]] = {
    "footwear": {
        "same": ["shoes", "shoe", "footwear", "sneakers", "trainers", "kicks"],
        "includes": [
            "boots", "heels", "sandals", "slippers", "flip flops", "chappals", "crocs", "loafers", "slides",
            "studs", "spikes", "jordans", "nike", "adidas", "puma", "reebok", "skechers", "asics", "bata",
            "woodland", "red tape", "new balance", "converse", "vans", "fila", "sparx", "liberty", "hush puppies",
            "neeman", "relaxo", "paragon", "khadims", "mochi", "clarks", "birkenstock", "under armour", "hoka",
        ],
    },
    "clothes": {
        "same": ["clothes", "clothing", "apparel", "outfit", "wear"],
        "includes": [
            "shirt", "tshirt", "t shirt", "tee", "top", "kurta", "kurti", "saree", "lehenga", "jeans", "trousers",
            "pants", "shorts", "skirt", "dress", "jacket", "hoodie", "sweatshirt", "sweater", "blazer", "suit",
            "coat", "tracksuit", "jersey", "dupatta", "sherwani",
        ],
    },
    "formals": {
        "same": ["formals", "formal wear", "formal"],
        "includes": ["blazer", "suit", "tie", "formal shirt", "trousers", "waistcoat", "formal shoes"],
    },
    "lab coat": {
        "same": ["lab coat", "apron", "lab apron"],
        "includes": [],
    },
    "calculator": {
        "same": ["calculator", "calc"],
        "includes": ["casio", "fx 991", "fx991", "scientific calculator", "graphing calculator", "texas instruments"],
    },
    "laptop": {
        "same": ["laptop", "notebook computer"],
        "includes": ["macbook", "thinkpad", "chromebook", "dell", "hp", "lenovo", "asus", "acer", "msi"],
    },
    "phone": {
        "same": ["phone", "mobile", "smartphone", "cellphone"],
        "includes": ["iphone", "samsung", "galaxy", "oneplus", "redmi", "xiaomi", "realme", "vivo", "oppo", "pixel", "motorola", "nothing phone"],
    },
    "headphones": {
        "same": ["headphones", "headphone", "earphones", "earphone", "earbuds", "headset"],
        "includes": ["airpods", "airdopes", "boat", "jbl", "sony", "neckband", "tws", "noise", "skullcandy"],
    },
    "speaker": {
        "same": ["speaker", "bluetooth speaker"],
        "includes": ["jbl", "boat", "sony", "marshall", "soundbar"],
    },
    "charger": {
        "same": ["charger", "adapter", "power adapter"],
        "includes": ["cable", "usb", "type c", "power bank", "powerbank", "extension board", "extension cord"],
    },
    "watch": {
        "same": ["watch", "wristwatch"],
        "includes": ["smartwatch", "smart watch", "fitness band", "fitbit", "apple watch", "titan", "fastrack", "casio"],
    },
    "bicycle": {
        "same": ["bicycle", "cycle", "bike"],
        "includes": ["hero", "firefox", "hercules", "btwin", "montra", "gear cycle", "mtb"],
    },
    "books": {
        "same": ["books", "book", "textbook", "textbooks", "novel", "guide"],
        "includes": ["reference book", "question bank", "notes", "pyq", "previous year papers"],
    },
    "drafter": {
        "same": ["drafter", "drafting kit", "drawing kit", "engineering drawing", "ed kit"],
        "includes": ["mini drafter", "set squares", "compass", "protractor", "drawing board", "sheet holder"],
    },
    "bag": {
        "same": ["bag", "backpack", "rucksack"],
        "includes": ["laptop bag", "duffel", "sling bag", "tote", "trolley", "suitcase", "wildcraft", "skybags", "american tourister"],
    },
    "mattress": {
        "same": ["mattress", "bed", "bedding"],
        "includes": ["pillow", "bedsheet", "blanket", "quilt", "razai", "comforter", "mattress topper"],
    },
    "kettle": {
        "same": ["kettle", "electric kettle"],
        "includes": ["induction", "cooktop", "hot plate", "rice cooker", "sandwich maker", "toaster"],
    },
    "fridge": {
        "same": ["fridge", "refrigerator", "mini fridge"],
        "includes": [],
    },
    "fan": {
        "same": ["fan", "table fan", "pedestal fan"],
        "includes": ["cooler", "air cooler"],
    },
    "lamp": {
        "same": ["lamp", "light", "study lamp", "table lamp"],
        "includes": ["led", "fairy lights", "night lamp", "bulb"],
    },
    "furniture": {
        "same": ["furniture"],
        "includes": ["chair", "table", "desk", "shelf", "rack", "cupboard", "stool", "bean bag", "study table"],
    },
    "sports": {
        "same": ["sports", "sport", "sports gear"],
        "includes": [
            "cricket", "bat", "football", "basketball", "volleyball", "badminton", "racket", "racquet",
            "shuttlecock", "tennis", "table tennis", "skipping rope", "dumbbells", "yoga mat", "gloves",
        ],
    },
    "racket": {
        "same": ["racket", "racquet"],
        "includes": ["yonex", "li ning", "badminton", "tennis", "squash"],
    },
    "gym": {
        "same": ["gym", "workout", "fitness"],
        "includes": ["dumbbells", "weights", "yoga mat", "resistance band", "protein", "shaker", "skipping rope"],
    },
    "arduino": {
        "same": ["arduino", "microcontroller"],
        "includes": ["esp32", "esp8266", "nodemcu", "raspberry pi", "breadboard", "sensor", "jumper wires"],
    },
    "electronics kit": {
        "same": ["project kit", "electronics kit", "components"],
        "includes": ["arduino", "raspberry pi", "breadboard", "resistor", "multimeter", "soldering", "sensor", "motor driver"],
    },
    "monitor": {
        "same": ["monitor", "display", "screen"],
        "includes": [],
    },
    "keyboard": {
        "same": ["keyboard"],
        "includes": ["mechanical keyboard", "mouse", "logitech"],
    },
    "camera": {
        "same": ["camera"],
        "includes": ["dslr", "mirrorless", "gopro", "canon", "nikon", "lens", "tripod"],
    },
    "guitar": {
        "same": ["guitar"],
        "includes": ["acoustic", "electric guitar", "ukulele", "capo", "yamaha"],
    },
    "food": {
        "same": ["food", "snacks", "meal", "eatables"],
        "includes": ["homemade", "cake", "brownies", "cookies", "maggi", "chocolate", "tiffin", "sandwich", "biryani"],
    },
    "stationery": {
        "same": ["stationery", "stationary"],
        "includes": ["pen", "pencil", "notebook", "register", "file", "folder", "highlighter", "stapler", "sticky notes"],
    },
}

STOPWORDS = {
    "a", "an", "and", "the", "for", "of", "in", "on", "with", "to", "my", "me", "i", "need", "want",
    "looking", "buy", "sell", "selling", "sale", "any", "some", "used", "second", "hand", "secondhand", "cheap",
}

MAX_WORDS = 6  # longer searches keep their first six words
TYPO_CUTOFF = 0.8  # difflib similarity needed to treat a word as a typo of another
_WORD = re.compile(r"[a-z0-9]+")


def _words(text: str) -> list[str]:
    return _WORD.findall((text or "").lower())


def singular(word: str) -> str:
    """Good-enough English singular for searching: shoes -> shoe, boxes -> box, batteries -> battery."""
    if len(word) <= 3 or word.endswith("ss"):
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("ches", "shes", "xes", "zes", "sses")):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word


def _norm(phrase: str) -> str:
    return " ".join(_words(phrase))


def _singular_phrase(phrase: str) -> str:
    return " ".join(singular(w) for w in phrase.split())


# phrase -> topic names where it's a "same" word, and the words each topic expands to.
_SAME: dict[str, set[str]] = {}
_EXPANDS: dict[str, set[str]] = {}
for _name, _topic in TOPICS.items():
    _EXPANDS[_name] = {_norm(p) for p in _topic["same"] + _topic["includes"]}
    for _p in _topic["same"]:
        for _key in {_norm(_p), _singular_phrase(_norm(_p))}:
            _SAME.setdefault(_key, set()).add(_name)

# Every word the dictionary knows (for typo correction), and its multi-word names.
_KNOWN_WORDS = {w for phrases in _EXPANDS.values() for p in phrases for w in p.split()}
_PHRASES = {key for phrases in _EXPANDS.values() for p in phrases if " " in p for key in (p, _singular_phrase(p))}


def _phrases_in(words: list[str]) -> list[tuple[str, int]]:
    """Split the search into dictionary phrases ("lab coat", "flip flops") and single words.
    Returns (phrase, word count)."""
    out = []
    i = 0
    while i < len(words):
        for size in (3, 2):
            if i + size <= len(words):
                phrase = " ".join(words[i:i + size])
                if phrase in _PHRASES or _singular_phrase(phrase) in _PHRASES:
                    out.append((phrase, size))
                    i += size
                    break
        else:
            out.append((words[i], 1))
            i += 1
    return out


def expand(query: str, vocabulary: set[str] = frozenset()) -> list[dict[str, bool]]:
    """The search as groups of terms: a listing must match at least one term from every group.
    Each term maps to whether it may match the start of a longer word: only what the student
    typed (4+ letters, or with digits), so "calcu" finds calculators while they type, but the
    related word "studs" doesn't find "study" and "cap" doesn't find "capacitor".
    `vocabulary` is extra known words (from listing titles) used to fix typos."""
    words = [w for w in _words(query) if w not in STOPWORDS][:MAX_WORDS] or _words(query)[:MAX_WORDS]
    known = _KNOWN_WORDS | set(vocabulary)
    groups = []
    for phrase, _ in _phrases_in(words):
        base = _singular_phrase(phrase)
        typed_prefix = any(c.isdigit() for c in phrase) or (" " not in phrase and len(phrase) >= 4)
        terms = {phrase: typed_prefix, base: typed_prefix}
        # A typo? Only for single words the dictionary and the listings don't know.
        if " " not in phrase and len(phrase) >= 4 and phrase not in known and base not in known:
            for fixed in difflib.get_close_matches(phrase, known, n=3, cutoff=TYPO_CUTOFF):
                terms.setdefault(fixed, False)
        for term in list(terms):
            for name in _SAME.get(term, set()) | _SAME.get(singular(term), set()):
                for related in _EXPANDS[name]:
                    terms.setdefault(related, False)
        groups.append({t: prefix for t, prefix in terms.items() if t})
    return groups


def _term_regex(term: str, prefix: bool) -> str:
    """`term` with any punctuation or spaces allowed between its words ("fx 991" matches
    "fx-991EX"). With `prefix` it may start a longer word; otherwise it must be the whole
    word, singular or plural (shoe, shoes; battery, batteries)."""
    words = term.split()
    last = singular(words[-1])
    if prefix:
        tail = last
    elif last.endswith("y") and len(last) > 3:
        tail = last[:-1] + "(y|ies)([^a-z0-9]|$)"
    else:
        tail = last + "(s|es)?([^a-z0-9]|$)"
    return "[^a-z0-9]*".join([*words[:-1], tail])


def _matches(column, terms: dict[str, bool]):
    """Any of the terms at the start of a word in `column`, ignoring case. One regex per group,
    which runs as ~ in Postgres and as Python's re in SQLite (the tests)."""
    alternatives = "|".join(sorted({_term_regex(t, prefix) for t, prefix in terms.items()}))
    return func.lower(func.coalesce(column, "")).regexp_match(f"(^|[^a-z0-9])({alternatives})")


def search_filter(model, groups: list[dict[str, bool]]):
    """Every group must match the title, description or category."""
    fields = (model.title, model.description, model.category)
    return [or_(*(_matches(f, terms) for f in fields)) for terms in groups]


def relevance(model, groups: list[dict[str, bool]], query: str):
    """Higher is better: words found in the title count most, and the exact search in the
    title most of all."""
    score = case((func.lower(model.title).contains(_norm(query)), 5), else_=0) if _norm(query) else 0
    for terms in groups:
        score = score + case((_matches(model.title, terms), 3), else_=0) + case((_matches(model.category, terms), 1), else_=0)
    return score


def title_vocabulary(titles) -> set[str]:
    """Words from current listing titles, so typos of brand names students use get fixed too."""
    return {w for t in titles for w in _words(t) if len(w) >= 4 and not w.isdigit()}
