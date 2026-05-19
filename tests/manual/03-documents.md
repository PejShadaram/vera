# 03 — Document Upload & Processing

**Pre-conditions:** Unlocked case. Test files from `/test-data/` available.

---

## DOC-01 · PDF upload and processing · P0

1. Go to Documents tab
2. Verify "My document" radio is selected by default
3. Click **+ Upload document** and select a `.txt` or `.pdf` file from `/test-data/`
4. Verify file appears in list with "Pending" badge
5. Click **Analyze documents**

**Expected:**
- Progress log shows streaming messages ("Downloading…", "Analyzing with AI…")
- On completion, a summary banner shows counts: "Vera found X items"
- Timeline, Evidence, and Tasks tabs populate with extracted data
- After dismiss, you are taken to Timeline tab — new entries are visible
- Document shows "Processed" badge

---

## DOC-02 · Opposing document upload · P1

1. Click **Filed against me** radio button
2. Upload any document
3. After processing completes, go to Evidence tab

**Expected:** Evidence item from the opposing document has a red "Filed Against Me" highlight/indicator.

---

## DOC-03 · Multiple file types accepted · P0

Test each of these formats — verify the browser file picker accepts them and upload succeeds:

| Format | Test file source |
|---|---|
| `.pdf` | Print any webpage to PDF |
| `.txt` | Any file from `/test-data/` |
| `.jpg` / `.png` | Any screenshot |
| `.m4a` | iPhone voice memo |
| `.m4v` | iPhone video |
| `.mp4` | Mac screen recording (Cmd+Shift+5) |
| `.docx` | Any Word document |
| `.eml` | Drag email from Apple Mail to desktop |

**Expected:** Each format uploads without error. File appears in list with correct filename.

---

## DOC-04 · Audio/video transcription · P1

1. Upload an `.m4a` voice memo (iPhone recording, any content)
2. Analyze the document

**Expected:** Processing log shows transcription step. Extracted content references the audio. If OPENAI_API_KEY is set, actual transcript extracted. If not set, placeholder message explains transcription requires the key.

---

## DOC-05 · Free tier document limit · P0

*(Requires a locked/unpaid case)*

1. On a locked case, upload and process 3 documents (the free limit)
4. Try to process a 4th document

**Expected:** After 3 processed docs, the Analyze button shows unlock prompt or the server returns "unlock_required". UnlockBanner is visible.

---

## DOC-06 · View document inline · P1

1. Upload a PDF document
2. Click the filename or a "view" link in the Documents list

**Expected:** PDF renders inline in an `<iframe>` below the document row. Images render as `<img>`. No 404 or auth error.

---

## DOC-07 · Delete document · P1

1. Upload any document
2. Click **delete** on that document row
3. Confirm the deletion prompt

**Expected:** Document disappears from list. If it was processed, the count in the stats bar decrements.

---

## DOC-08 · AutoProcessor on fresh case · P0

1. Complete the wizard, upload 1 document, click "Skip for now — go to my case"
2. If the case is unlocked, verify the AutoProcessor banner appears immediately on the case page

**Expected:** Amber banner "Vera is reading your documents…" with animated dots. After processing, shows "Vera found X items" with tag counts. Vera's Take re-analyzes. No manual "Analyze" click needed.
