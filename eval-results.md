# DocChat accuracy test

- **Date:** 2026-10-11
- **Mode:** live (gemini embeddings + claude-haiku-5-5)
- **Documents:** patient-handbook.pdf, price-list-2026.pdf, staff-policy-manual.pdf

## Score: 20/20 (100%)

| | Result |
|---|---|
| Answerable questions correct, with the right page cited | 16/16 |
| Unanswerable questions correctly refused ("I don't know") | 4/4 |
| Average response time | 2.52 s |
| Claude tokens used (all 20 questions) | 37,460 in / 1,202 out |

## Every question

| # | Question | Result | Why | Cited | Answer |
|---|---|---|---|---|---|
| 1 | What is the late-cancellation fee? | PASS | correct + right page | patient-handbook.pdf p.3; price-list-2026.pdf p.2 | The late-cancellation or missed appointment fee is $40 [1][2]. Cancellations with less than 24 hours' notice are charged this fee, but it is waived once per year and always waived for genuine emergencies or illness [1]. |
| 2 | How much notice do I need to give if I want to cancel an appointment? | PASS | correct + right page | patient-handbook.pdf p.3 | You need to give at least 24 hours' notice to cancel or move an appointment [1]. Cancellations with less notice, and missed appointments, are charged a $40 late-cancellation fee, which is waived once per year and always waived for genuine emergencies or illness [1]. |
| 3 | What time does the clinic close on Thursdays? | PASS | correct + right page | patient-handbook.pdf p.1 | The clinic closes at 7:00 PM on Thursdays [1]. |
| 4 | Is the clinic open on Saturdays? | PASS | correct + right page | patient-handbook.pdf p.1 | No, the clinic is closed on Saturdays, Sundays and public holidays [1]. |
| 5 | Which insurance plans are you in-network with? | PASS | correct + right page | patient-handbook.pdf p.4 | The clinic is in-network with Delta Dental, Cigna, MetLife and Aetna. For these plans, the clinic bills the insurer directly and you pay only your share on the day [1]. The clinic does not accept Medicaid [1]. |
| 6 | Do you accept Medicaid? | PASS | correct + right page | patient-handbook.pdf p.4 | No, the clinic does not accept Medicaid. [1] |
| 7 | How much does in-clinic teeth whitening cost? | PASS | correct + right page | price-list-2026.pdf p.2; patient-handbook.pdf p.4 | In-clinic teeth whitening costs $450 per session (one session) [1]. Bright Smile Membership members get 15 percent off treatments on that price list, but whitening kits are excluded from the discount [1][3]. |
| 8 | What is the price of a porcelain crown? | PASS | correct + right page | price-list-2026.pdf p.2 | The price of a porcelain crown is $1,100 [1]. |
| 9 | How much is a professional cleaning? | PASS | correct + right page | price-list-2026.pdf p.1; price-list-2026.pdf p.2 | A professional cleaning (scale and polish) is $120 [1]. Patients on the Bright Smile Membership get 15 percent off treatments listed on page 2 of the price list, but the cleaning is on page 1, so that discount is not stated for it [1][2]. |
| 10 | What should I do if an adult tooth gets knocked out? | PASS | correct + right page | patient-handbook.pdf p.5 | If an adult tooth is knocked out, hold it by the crown, not the root, and rinse it gently without scrubbing [1]. Try to put it back in its socket. If that isn't possible, keep it in milk and come to the clinic within one hour, because the chance of saving the tooth drops quickly after that [1]. |
| 11 | When are the emergency appointment slots? | PASS | correct + right page | patient-handbook.pdf p.5 | The clinic keeps two emergency slots open every weekday, at 11:30 AM and 4:00 PM, for patients in pain [1]. |
| 12 | How much does the membership plan cost per month? | PASS | correct + right page | patient-handbook.pdf p.4 | The Bright Smile Membership costs $29 per month. [1] |
| 13 | How long do you keep adult patient records? | PASS | correct + right page | patient-handbook.pdf p.6 | Adult patient records are kept for 10 years after your last visit. [1] |
| 14 | How many days of annual leave do full-time staff get? | PASS | correct + right page | staff-policy-manual.pdf p.2 | Full-time employees receive 20 days of paid annual leave per year, plus public holidays [1]. |
| 15 | How long is the probation period for new employees? | PASS | correct + right page | staff-policy-manual.pdf p.1 | New employees have a 90-day probation period. [1] |
| 16 | What is the yearly training budget for clinical staff? | PASS | correct + right page | staff-policy-manual.pdf p.3 | Each clinical employee has a continuing education budget of $1,500 per year [1]. Clinical staff also receive three paid study days [1]. |
| 17 | Do you offer dental implants? | PASS | said "I don't know" |  | I don't know based on the uploaded documents. |
| 18 | What is the clinic's Wi-Fi password? | PASS | said "I don't know" |  | I don't know based on the uploaded documents. |
| 19 | How much does Invisalign cost? | PASS | said "I don't know" |  | I don't know based on the uploaded documents. |
| 20 | Who won the last football World Cup? | PASS | said "I don't know" |  | I don't know based on the uploaded documents. |
