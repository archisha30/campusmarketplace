"""Page-at-a-time lists for the Marketplace and Resource Hub.

Opt-in: when no `page` is given, everything is returned (the seller's own Dashboard and
Profile need all of their listings). Pages are clamped, so asking for page 9 of 3 returns
page 3 instead of an empty list.
"""

import math

PAGE_SIZE_MAX = 60


def paginate(query, page: int | None, page_size: int):
    """Returns (items, total, page, page_size, pages); page/page_size/pages are None if unpaged."""
    total = query.count()
    if page is None:
        return query.all(), total, None, None, None
    page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
    pages = max(1, math.ceil(total / page_size))
    page = min(max(page, 1), pages)
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total, page, page_size, pages
