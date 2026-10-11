"""Generates the fictional demo PDFs in sample-docs/ (Bright Smile Dental).

Run: python3 scripts/make-sample-docs.py   (needs: pip install reportlab)
Every section starts on a new page so the page numbers used in eval/questions.json stay fixed.
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib import colors

OUT = Path(__file__).resolve().parent.parent / "sample-docs"
OUT.mkdir(exist_ok=True)
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=18, spaceAfter=10)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=13, spaceBefore=8, spaceAfter=4)
P = ParagraphStyle("p", parent=ss["BodyText"], fontSize=10.5, leading=15, spaceAfter=6)


def build(filename, title, pages):
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillGray(0.45)
        canvas.drawString(20 * mm, 12 * mm, f"Bright Smile Dental - {title} (fictional demo document)")
        canvas.drawRightString(190 * mm, 12 * mm, f"Page {doc.page}")
        canvas.restoreState()

    story = []
    for i, page in enumerate(pages):
        if i:
            story.append(PageBreak())
        for kind, content in page:
            if kind == "h1":
                story.append(Paragraph(content, H1))
            elif kind == "h2":
                story.append(Paragraph(content, H2))
            elif kind == "p":
                story.append(Paragraph(content, P))
            elif kind == "table":
                t = Table(content, colWidths=[95 * mm, 55 * mm])
                t.setStyle(TableStyle([
                    ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
                    ("FONT", (0, 1), (-1, -1), "Helvetica", 10),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.black),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.lightgrey),
                    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
    doc = SimpleDocTemplate(str(OUT / filename), pagesize=A4, title=title, author="Bright Smile Dental (fictional)",
                            leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=22 * mm)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print("wrote", OUT / filename)


handbook = [
    [("h1", "Patient Handbook"),
     ("p", "Welcome to Bright Smile Dental. This handbook explains how our clinic works, what to expect at your visits, and the policies that keep appointments fair for every patient. Please read it before your first appointment."),
     ("h2", "Opening hours"),
     ("p", "The clinic is open Monday to Wednesday from 9:00 AM to 5:00 PM, Thursday from 9:00 AM to 7:00 PM, and Friday from 9:00 AM to 3:00 PM. We are closed on Saturdays, Sundays and public holidays. Our late Thursday hours are reserved first for school-age children and working patients."),
     ("h2", "Location and parking"),
     ("p", "We are located at 214 Maple Avenue, Suite 3, on the second floor above the pharmacy. Free patient parking is available in the rear lot for up to two hours. The entrance has a ramp and the building has an elevator, so the clinic is fully wheelchair accessible."),
     ("h2", "Contacting us"),
     ("p", "Call the front desk at (555) 014-2290 during opening hours. Outside opening hours our AI receptionist answers the phone, can book appointments and takes messages for the team. You can also email hello@brightsmile.example and we reply within one business day.")],
    [("h1", "Your First Visit"),
     ("p", "New patients should arrive 15 minutes early to complete the medical history form. Please bring a photo ID, your insurance card, and a list of any medications you take. If you have dental X-rays from another clinic taken in the last 12 months, ask them to send the files to us before your visit."),
     ("p", "A first visit takes about 60 minutes. It includes a full examination, a set of digital X-rays, a professional cleaning when time allows, and a treatment plan with prices explained before anything is done. We never start treatment you have not agreed to."),
     ("h2", "Children"),
     ("p", "We see children from age 2. A parent or legal guardian must stay in the clinic for patients under 16. We recommend a child's first check-up by their second birthday, and every six months after that. Children under 12 receive a free fluoride treatment at each check-up."),
     ("h2", "Anxious patients"),
     ("p", "Tell us if you feel nervous about dental treatment. We can book a longer appointment, explain each step before we do it, agree on a stop signal, and offer noise-cancelling headphones. Nitrous oxide (laughing gas) is available for an extra charge listed in our price list.")],
    [("h1", "Appointments and Cancellations"),
     ("p", "You can book by phone, by email, or through our AI receptionist at any time. Routine check-ups are booked in 30-minute slots. Longer treatments such as crowns or root canals are booked in 60 to 90 minute slots."),
     ("h2", "Cancellation policy"),
     ("p", "Please give at least 24 hours' notice if you need to cancel or move an appointment. Cancellations with less than 24 hours' notice, and missed appointments, are charged a $40 late-cancellation fee. The fee is waived once per year, and always waived for genuine emergencies or illness."),
     ("p", "Patients who miss three appointments in a 12-month period without notice may be asked to pay a deposit before booking further appointments."),
     ("h2", "Running late"),
     ("p", "If you arrive more than 15 minutes late we may need to shorten your appointment or rebook it, so the patients after you are not kept waiting. Call us if you know you will be late and we will do our best to fit you in."),
     ("h2", "Reminders"),
     ("p", "We send a text message reminder two days before every appointment and a second reminder on the morning of the visit. Reply C to confirm or R to ask us to reschedule.")],
    [("h1", "Payments and Insurance"),
     ("p", "Payment is due at the end of each visit. We accept cash, debit and credit cards, Apple Pay and Google Pay. We do not accept personal cheques."),
     ("h2", "Insurance"),
     ("p", "We are in-network with Delta Dental, Cigna, MetLife and Aetna. For these plans we bill the insurer directly and you pay only your share on the day. For other insurers we provide an itemised receipt so you can claim the cost back yourself. Medicaid is not accepted at this clinic."),
     ("h2", "Payment plans"),
     ("p", "For treatment plans over $500 we offer interest-free payment plans over 3, 6 or 12 months. A payment plan needs a 20 percent deposit on the day treatment starts. Ask the front desk for the payment plan form."),
     ("h2", "Membership plan"),
     ("p", "Patients without insurance can join the Bright Smile Membership for $29 per month. It covers two check-ups and two cleanings per year, all routine X-rays, and gives 15 percent off any other treatment.")],
    [("h1", "Emergencies"),
     ("p", "A dental emergency includes severe tooth pain, a knocked-out tooth, a broken tooth with sharp edges, or swelling in the gums or face. Call us as soon as possible. We keep two emergency slots open every weekday, one at 11:30 AM and one at 4:00 PM, for patients in pain."),
     ("h2", "Knocked-out tooth"),
     ("p", "If an adult tooth is knocked out, hold it by the crown, not the root. Rinse it gently without scrubbing and try to put it back in its socket. If that is not possible, keep it in milk and come to the clinic within one hour, because the chance of saving the tooth drops quickly after that."),
     ("h2", "When to go to hospital"),
     ("p", "If facial swelling makes it hard to breathe or swallow, or you have a high fever with dental pain, call 911 or go to the nearest emergency room straight away. Do not wait for a dental appointment."),
     ("h2", "After hours"),
     ("p", "Outside opening hours, call our main number. The AI receptionist will take an urgent message and the on-call dentist will call you back, usually within one hour, between 7:00 AM and 10:00 PM.")],
    [("h1", "Privacy and Records"),
     ("p", "Your records are stored in an encrypted practice management system. Only clinical staff involved in your care and our billing team can access them. We never sell patient data."),
     ("h2", "Getting copies of your records"),
     ("p", "You can request a copy of your dental records, including X-rays, by email or in person. We provide digital copies free of charge within 10 business days. Printed copies cost $15 to cover printing."),
     ("h2", "How long we keep records"),
     ("p", "Adult patient records are kept for 10 years after your last visit. Records for children are kept until the patient turns 28. After that, records are securely destroyed."),
     ("h2", "Feedback and complaints"),
     ("p", "We want to hear about anything we could do better. Speak to the practice manager, Dana Ortiz, or email feedback@brightsmile.example. We acknowledge every complaint within 2 business days and aim to resolve it within 14 days.")],
]

prices = [
    [("h1", "Price List 2026"),
     ("p", "These are our standard self-pay prices, valid from January 1, 2026. Insured patients pay their plan's share instead. Every treatment plan is priced in writing before treatment starts."),
     ("h2", "Preventive care"),
     ("table", [["Treatment", "Price"],
                ["New patient exam with X-rays", "$150"],
                ["Routine check-up (existing patients)", "$75"],
                ["Professional cleaning (scale and polish)", "$120"],
                ["Deep cleaning, per quarter of the mouth", "$210"],
                ["Fluoride treatment (adults)", "$35"],
                ["Fissure sealant, per tooth", "$45"],
                ["Single X-ray", "$25"]]),
     ("h2", "Fillings"),
     ("table", [["Treatment", "Price"],
                ["Tooth-coloured filling, small", "$150"],
                ["Tooth-coloured filling, large", "$250"],
                ["Temporary filling", "$60"]])],
    [("h1", "Price List 2026 (continued)"),
     ("h2", "Restorative and cosmetic"),
     ("table", [["Treatment", "Price"],
                ["Root canal, front tooth", "$800"],
                ["Root canal, molar", "$1,250"],
                ["Porcelain crown", "$1,100"],
                ["Simple extraction", "$180"],
                ["Wisdom tooth extraction (surgical)", "$350"],
                ["Teeth whitening, in-clinic (one session)", "$450"],
                ["Take-home whitening kit", "$250"],
                ["Night guard (custom)", "$400"]]),
     ("h2", "Other charges"),
     ("table", [["Item", "Price"],
                ["Nitrous oxide (laughing gas), per visit", "$75"],
                ["Late-cancellation or missed appointment fee", "$40"],
                ["Printed copy of records", "$15"],
                ["Emergency visit, outside regular slots", "$95 surcharge"]]),
     ("p", "Prices include all routine materials. Lab fees for crowns and night guards are included in the price shown. Patients on the Bright Smile Membership receive 15 percent off the treatments on this page, except whitening kits.")],
]

staff = [
    [("h1", "Staff Policy Manual"),
     ("p", "This manual applies to all employees of Bright Smile Dental. It is reviewed every January by the practice manager. Where this manual and your employment contract differ, your contract applies."),
     ("h2", "Working hours"),
     ("p", "Full-time staff work 38 hours per week on a rota published two weeks in advance. Shift swaps must be agreed by both staff members and approved by the practice manager at least 48 hours before the shift."),
     ("h2", "Probation"),
     ("p", "New employees have a 90-day probation period. During probation the notice period on either side is one week. After probation, the notice period is four weeks for clinical staff and two weeks for administrative staff.")],
    [("h1", "Leave"),
     ("h2", "Annual leave"),
     ("p", "Full-time employees receive 20 days of paid annual leave per year plus public holidays. Leave requests must be submitted at least four weeks in advance for periods longer than three days. No more than two clinical staff may be on leave at the same time. Up to 5 unused days can be carried over to the next year."),
     ("h2", "Sick leave"),
     ("p", "Employees receive 10 days of paid sick leave per year. Call the practice manager before 7:30 AM if you cannot come in, so patients can be rescheduled. A doctor's note is required for absences longer than three consecutive days."),
     ("h2", "Parental leave"),
     ("p", "Employees with at least 12 months of service receive 16 weeks of paid parental leave, which can be taken any time in the first year after a birth or adoption.")],
    [("h1", "Training and Conduct"),
     ("h2", "Training budget"),
     ("p", "Each clinical employee has a continuing education budget of $1,500 per year and three paid study days. Administrative staff have a budget of $500 per year. Training must be approved by the practice manager before booking."),
     ("h2", "Uniform"),
     ("p", "Clinical staff are provided with five sets of scrubs per year. Closed-toe shoes are required in all clinical areas. Jewellery on the hands and wrists is not permitted during treatment, except a plain wedding band."),
     ("h2", "Infection control"),
     ("p", "All clinical staff must complete infection control refresher training every 12 months. Instruments are sterilised in the autoclave after every patient and each cycle is logged by the assistant who ran it.")],
]

build("patient-handbook.pdf", "Patient Handbook", handbook)
build("price-list-2026.pdf", "Price List 2026", prices)
build("staff-policy-manual.pdf", "Staff Policy Manual", staff)
