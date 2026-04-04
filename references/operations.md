# Operations — Systems & Administration

## Client Onboarding

### Pre-Onboarding
- [ ] Contract signed
- [ ] First payment received
- [ ] Welcome email sent
- [ ] Calendar invite for kickoff call

### Welcome Email Template
```
Subject: Welcome to [Company Name] - Let's Get Started

Hi [Name],

Excited to officially start working together!

Here's what happens next:

1. Kickoff Call (this [day] at [time])
   - Meet your team
   - Review current state
   - Set goals for first 30 days

2. Access We'll Need
   - [List of systems: CRM, accounting, etc.]
   - [Admin access for each]
   - Point of contact for questions

3. What to Expect
   - Week 1: Discovery + Dashboard build
   - Week 2-3: First automation
   - Week 4: Training + Strategy presentation

See you [day]!

Best,
Michel
```

### Kickoff Call Agenda (30 min)
1. Introductions (5 min)
2. Current state review (10 min)
3. Goals for next 30 days (5 min)
4. Access and next steps (5 min)
5. Schedule recurring calls (5 min)

---

## Invoicing

### Tools
- **Stripe:** For recurring payments, credit cards
- **Wave:** For Quebec invoicing, GST/QST
- **QuickBooks:** For comprehensive accounting

### Invoice Setup
- Send on 1st of each month
- Due within 15 days
- Auto-pay enabled for retainers

### Invoice Template
```
INVOICE #[number]
Date: [Date]
Due: [Date + 15 days]

Bill To:
[Company Name]
[Address]

From:
Michel Tremblay
[Your address]

Description: [Month] AI Consulting Services - [Tier]
Amount: $X,XXX.XX

Subtotal: $X,XXX.XX
GST/QST (if applicable): $X.XX
Total: $X,XXX.XX

Payment Methods:
- Credit Card: [Stripe link]
- Wire/Transfer: [Bank details]
- Cheque: Mail to address above

Thank you for your business!
```

---

## Contract Management

### Storage
- Google Drive folder: `/clients/[Company]/contracts`
- Naming: `[Company]_[Year]_Contract.pdf`

### Key Terms to Include
- Scope of work
- Payment schedule
- Termination clause (30 days)
- Confidentiality
- IP ownership (you own methods, client owns their data)

---

## Project Management

### Tool Options
- **Notion:** For client docs, roadmaps
- **Trello:** Simple board for tasks
- **Asana:** More complex projects
- **Google Sheets:** Simple tracking

### Client-Facing Dashboard
Create a shared Notion page with:
- Current priorities
- Progress on goals
- Recent deliverables
- Next steps
- Links to tools

---

## Time Tracking

### Why Track
- Ensure you're not over-delivering
- Know true profitability
- Plan capacity
- Invoice accurately if hourly

### Tools
- **Toggl:** Simple time tracking
- **Clockify:** Free, team features
- **Notion:** Custom setup

### What to Track
- Client calls
- Implementation time
- Training sessions
- Administrative

---

## File Organization

### Folder Structure
```
/clients
  /[Company Name]
    /contracts
    /invoices
    /deliverables
    /training-materials
    /assets
    /screenshots
```

### Naming Convention
`[Date]_[Description]_[Version]`
Example: `2026-04-04_Dashboard_v1.png`

---

## Taxes (Quebec)

### GST/QST
- Register for GST/QST if revenue >$30K/year
- Charge: 5% GST + 9.975% QST
- File monthly or quarterly

### Income Tax
- Sole proprietorship or corporation
- Keep receipts for 6 years
- Consider accountant for filing

### Estimated Payments
- Set aside 25-30% of income
- Quarterly payments to CRA

---

## Communication Templates

### Weekly Check-in
```
Hey [Name], quick check-in on how things are going. Any questions or blockers I should know about? Anything you want to priority for this week?
```

### Monthly Report
```
Hi [Name], here's your [Month] summary:

✅ Completed:
- [Item 1]
- [Item 2]

📊 Metrics:
- [Dashboard usage]
- [Automation impact]
- [Team training]

🎯 Next Month:
- [Priority 1]
- [Priority 2]

Let me know if anything needs adjustment!
```

### Meeting Request
```
Hey [Name], wanted to schedule our [weekly/bi-weekly] catch-up. I have [time] and [time] available this week. What works for you?
```

---

## Security

### Client Data
- Never share client data with other clients
- Encrypt sensitive files
- Use 2FA everywhere

### Your Systems
- Strong passwords
- 2FA on all accounts
- Regular password updates
- VPN for public WiFi

---

## Legal

### NDA Template
Include in contract or separate:
- Definition of confidential information
- Exclusions
- Duration
- Remedies

### Liability
- Cap liability to fees paid
- Include indemnification
- Professional liability insurance (recommended)

---

## When to Outsource

### Now
- Bookkeeping (Wave or accountant)
- Taxes (accountant)

### Later
- Administrative help (VA)
- Payroll (if hiring)
- Legal (lawyer for contracts)