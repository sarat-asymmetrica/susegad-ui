# Rupees and the Indian clock

Pure functions for money and time, the same on every machine. Import from `susegad/core/intl.core.js`. Nothing in it reads the clock or the machine's zone: you pass the instant, and the zone is Asia/Kolkata unless you say otherwise.

## Money

```js
rupees(125000)                 // ₹1,25,000
rupees(12500000)               // ₹1,25,00,000
rupees(99.5)                   // ₹99.50   (paise when the amount has them)
rupees(1250, { paise: true })  // ₹1,250.00
rupees(99.5, { paise: false }) // ₹100
rupees(-500)                   // -₹500
rupees(0)                      // ₹0
rupees('soon')                 // ''       (never "NaN"; also '' for an amount too big to keep its paise)
rupees(1.005, { paise: true }) // ₹1.01    (half a paisa rounds up, as Intl does)
formatMoney(1234567, 'USD')    // USD 1,234,567
```

The grouping is written by hand (the last three digits, then pairs) so no browser, Node build or locale can change it. A currency other than the rupee, Rs. or INR groups in thousands. `groupIndian()` and `groupWestern()` are the pieces.

## Time and dates

```js
istDay(date)                       // "2026-10-06", the IST calendar day, even on a phone set to New York
clock(date)                        // "11 pm", "6:30 am", "12 noon"
clock24(date)                      // "23:00"
formatTime(date, { locale })       // the clock the locale writes: en-IN "11 pm", de-DE "23:00"
weekday(date)                      // "Tue" (long: true for "Tuesday")
formatDate(date, IST, { year })    // "Tue 6 Oct", "Tue 6 Oct 2026"
formatWhen(start, end)             // "Sun 4 Oct, 11 am to 1 pm"
relativeDay(now, then)             // "today", "tomorrow", "yesterday", "in 5 days"
parseWhen('2026-10-04T11:00')      // the instant, reading the clock time as IST
```

Days are counted on the IST calendar, not in 24-hour spans: at 11 pm, 1 am is "tomorrow". Any other IANA zone name can be passed where a function takes a zone. There is no Temporal here on purpose; it is not in stable Safari yet, and `Intl.DateTimeFormat` does the zone arithmetic.

## Where it is used

`data-table` (money cells), `menu` and `wa-order` (prices, the order total, the earliest order day), `event-card` and `event-list` (the clock and the dates) and the `room-details` recipe (the rate). The booking kernels keep their own `rupees` because they are copied out as a drift-tested unit.

The tests fake the instant and also run a child process with `TZ` set to New York, London and Auckland, and with other locales, to show the answers do not move.
