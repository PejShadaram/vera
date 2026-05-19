# Vera Manual Test Data

Realistic test documents for each case type. Upload these to Vera to test document processing, AI extraction, and the full case workflow.

## How to use

1. Create a new case in Vera using the matching case type
2. Go to Documents and upload the files for that case type
3. Click "Analyze documents" to test AI processing
4. Check Timeline, Evidence, and Tasks tabs for extracted data
5. Use Ask Vera / the FAB to test the chat drawer with populated case context

## Case types

| Folder | Case type | Opposing party | State |
|---|---|---|---|
| `divorce/` | Divorce | Robert Chen | California |
| `custody/` | Child Custody | Marcus Webb | Texas |
| `landlord-tenant/` | Landlord / Tenant | Sunrise Property Management | Florida |
| `employment/` | Employment | TechFlow Solutions Inc. | Washington |
| `small-claims/` | Small Claims | Davis Contracting LLC | Colorado |
| `other/` | Other | Westside Homeowners Association | Arizona |

## What each file produces when processed

Each file is designed to generate a meaningful AI extraction with:
- 4–8 timeline entries
- 2–4 evidence items  
- 2–3 task suggestions

Files are plain text (.txt) and .eml (email) format — both supported by Vera's document processor.
