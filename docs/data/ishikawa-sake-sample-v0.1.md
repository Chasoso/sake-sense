# Ishikawa sake sample v0.1

This is a small, experimental sample for the EXP-002 product-connection experiment. It contains five products from two Ishikawa producers, not a complete catalog or a quality ranking. The machine-readable data is [`ishikawa-sake-sample.v0.1.json`](../../src/domain/data/ishikawa-sake-sample.v0.1.json), validated by [`ishikawa-sake-sample.schema.json`](../../schemas/ishikawa-sake-sample.schema.json).

## Sources reviewed and retained

The retained sources are official product pages from [菊姫](https://www.kikuhime.co.jp/) and [天狗舞 / 車多酒造](https://www.tengumai.co.jp/), checked on 2026-08-29:

- [菊姫 特撰純米 and product information](https://www.kikuhime.co.jp/products/page/2/): `濃醇旨口` is used as a source-supported reference to `nojun`.
- [菊姫 山廃純米](https://www.kikuhime.co.jp/products/%E5%B1%B1%E5%BB%83%E7%B4%94%E7%B1%B3/): `濃醇` is explicitly used; it references `nojun`.
- [菊姫 加州菊酒](https://www.kikuhime.co.jp/products/%E5%8A%A0%E5%B7%9E%E8%8F%8A%E9%85%92/): `酸味` and `キレが良い` are explicit; it references `sanmi` and `kire`.
- [菊姫吟醸](https://www.kikuhime.co.jp/products/%E8%8F%8A%E5%A7%AB%E5%90%9F%E9%86%B8/): `軽やか` is explicit; its `tanrei` reference is deliberately `inferred-from-wording`, not an official claim that the product is 淡麗.
- [天狗舞 山廃仕込純米酒](https://www.tengumai.co.jp/products/junmai/19.html): `酸味` is explicit; `濃厚な香味` is recorded as an inferred, limited reference to `nojun`.

The sample uses concise paraphrases and stores the source URL, access date, source type, and transformation note for each product. No product description is copied at length.

## Omitted and ambiguous material

Products were omitted when the available source did not provide a sufficiently clear connection to an existing dictionary term. No new dictionary terms were added. The two `inferred-from-wording` mappings remain visibly qualified because `濃厚` and `軽やか` should not be silently treated as authoritative synonyms for the dictionary terms.

## Licensing and limitations

The sources are publicly visible official websites, not automatically open-data sources. This repository stores identifiers, factual metadata, short paraphrases, and provenance for local experimentation; it does not assert a general right to republish source prose or product images. Human review should confirm reuse expectations before any broader publication.

The sample is not comprehensive, does not rank or recommend products, and does not claim that Sake Sense independently evaluated taste. Human review must decide whether the product selection, Ishikawa connection, source credibility, wording, and inferred mappings are suitable for EXP-002.
