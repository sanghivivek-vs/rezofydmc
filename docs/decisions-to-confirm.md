# Decisions to confirm (Build guide §0, §11)

The Build guide instructs: **ask, don't assume** on pricing rules, tax handling,
cancellation policy logic, and the items below. These are tracked here and must
be resolved with the business / Tour-platform team before the relevant slice is
considered done.

| #   | Topic                      | Question                                                                                                                                                            | Blocks                        |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Integration auth           | OAuth 2.0 client-credentials or API key between platforms? (ADR 0005 assumes OAuth, pending)                                                                        | Integration layer             |
| 2   | Hotel responsibility split | Does the agency book hotels (DMC fills ground services only), or does the DMC quote hotels too?                                                                     | Catalog, Costing, Integration |
| 3   | `bookingStatus = TM`       | Confirm "TM" means Tour-Manager-led with no supplier booking required.                                                                                              | Itinerary, Operations         |
| 4   | Tax handling               | Which taxes/service charges apply, at what level (per-line vs quote), and to optional items? Current engine supports explicit, configurable tax lines — values TBD. | Costing                       |
| 5   | Cancellation policy        | What cancellation-policy logic should the quote encode? Currently a free-text field only.                                                                           | Quote, Documents              |
| 6   | Child & infant pricing     | Confirm default age bands and charge percentages (engine supports configurable `childRules`; infants free by default).                                              | Costing                       |
| 7   | Rounding mode              | Confirm `half-up` (current default) vs bankers' rounding for sell prices and taxes.                                                                                 | Costing                       |
| 8   | FX source                  | Where do stored FX rates come from, and how often refreshed? Engine records the rate used per line but does not fetch.                                              | Costing                       |
| 9   | Pricing model default      | Per-pax vs total as the headline a given agency sees by default.                                                                                                    | Quote                         |

> Update this table (and the relevant ADR) as each item is decided. Do not
> hard-code an assumed answer into the engine without confirmation.
