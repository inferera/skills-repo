# Import Script v2 Migration Fix

## Problem

When users submitted import issues with the `import-approved` label, the CI/CD workflow failed with:

```
Error: items[0].targetSubcategory must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/: undefined
    at assertSlug (file:///home/runner/work/skills-repo/skills-repo/scripts/import-from-issue.mjs:94:11)
```

**Root Cause**: In v2 refactoring, we removed the subcategory layer to create a flat category structure (`skills/<category>/<id>/`), but the import script and documentation still expected the old three-level structure (`skills/<category>/<subcategory>/<id>/`).

---

## Solution

### 1. Updated Import Script

**File**: `scripts/import-from-issue.mjs`

**Changes**:
- Removed `targetSubcategory` validation (line 123-125)
- Updated destination path from `skills/${category}/${subcategory}/${id}` to `skills/${category}/${id}` (line 236)
- Updated fast-glob patterns from `skills/*/*/${id}` to `skills/*/${id}` (lines 242, 279)

**Before**:
```javascript
let targetCategory = it.targetCategory;
let targetSubcategory = it.targetSubcategory;
assertSlug(`items[${idx}].targetCategory`, targetCategory);
assertSlug(`items[${idx}].targetSubcategory`, targetSubcategory);
// ...
return { sourcePath, targetCategory, targetSubcategory, id, title, tags, isUpdate };
```

**After**:
```javascript
let targetCategory = it.targetCategory;
assertSlug(`items[${idx}].targetCategory`, targetCategory);
// ...
return { sourcePath, targetCategory, id, title, tags, isUpdate };
```

---

### 2. Updated Issue Template

**File**: `.github/ISSUE_TEMPLATE/import-request.md`

**Changes**:
- Removed `targetSubcategory: ui-ux` line from example

**Before**:
```yaml
items:
  - sourcePath: path/to/skill-dir
    id: your-skill-id
    title: Human readable title
    targetCategory: design
    targetSubcategory: ui-ux  # ❌ Removed
```

**After**:
```yaml
items:
  - sourcePath: path/to/skill-dir
    id: your-skill-id
    title: Human readable title
    targetCategory: design
```

---

### 3. Updated Documentation

**Files**:
- `docs/importer.md` (English)
- `docs/importer.zh-CN.md` (Chinese)

**Changes**:
- Updated "Use the UI" section: "Pick a target `category`" instead of `category/subcategory`
- Updated issue format example: removed `targetSubcategory` field
- Updated rules: only `id` and `targetCategory` must be slugs
- Updated destination path: `skills/<category>/<id>/` instead of `skills/<category>/<subcategory>/<id>/`

---

### 4. Updated Review Page

**File**: `site/app/review/page.tsx`

**Changes**:
- Removed `targetSubcategory` from `ReviewItem` type (line 15)
- Updated target location display to show only category (line 158)

**Before**:
```typescript
type ReviewItem = {
  // ...
  targetCategory: string;
  targetSubcategory: string;  // ❌ Removed
};

// Display
<code>{item.targetCategory}/{item.targetSubcategory}</code>
```

**After**:
```typescript
type ReviewItem = {
  // ...
  targetCategory: string;
};

// Display
<code>{item.targetCategory}</code>
```

---

## Files Modified

1. `scripts/import-from-issue.mjs` - Import script logic
2. `.github/ISSUE_TEMPLATE/import-request.md` - Issue template
3. `docs/importer.md` - English documentation
4. `docs/importer.zh-CN.md` - Chinese documentation
5. `site/app/review/page.tsx` - Review page types and display

---

## Verification

### Validation Passed:
```bash
npm run validate
# ✓ OK: skills validated
```

### Build Passed:
```bash
cd site && npm run build
# ✓ Generating static pages (95/95)
# ✓ All pages built successfully
```

---

## Updated Issue Format (v2)

Users should now submit issues with this format:

```yaml
<!-- skillhub-import:v2
sourceRepo: https://github.com/OWNER/REPO
ref: main
items:
  - sourcePath: path/to/skill-dir
    id: your-skill-id
    title: Human readable title
    targetCategory: development
    # Optional:
    # tags: [tag1, tag2]
    # isUpdate: true
-->
```

**Key Changes**:
- ✅ Only `targetCategory` required (no subcategory)
- ✅ Skills will be placed at `skills/<category>/<id>/`
- ✅ Flat category structure matches v2 design

---

## Migration Impact

### Before v2 (3-level structure):
```
skills/
  ├── development/
  │   ├── frontend/
  │   │   └── react-skill/
  │   └── backend/
  │       └── api-skill/
  └── design/
      └── ui-ux/
          └── design-skill/
```

### After v2 (2-level structure):
```
skills/
  ├── development/
  │   ├── react-skill/
  │   └── api-skill/
  └── design/
      └── design-skill/
```

**Benefits**:
- ✅ Simpler structure
- ✅ Easier to browse and navigate
- ✅ Reduced nesting complexity
- ✅ More flexible categorization

---

## Testing Checklist

- [x] Import script validates correctly without targetSubcategory
- [x] Issue template updated to match v2 format
- [x] Documentation reflects new structure
- [x] Review page displays correct category path
- [x] npm run validate passes
- [x] Site builds successfully (95 static pages)
- [x] No TypeScript errors

---

## Next Steps

When a user submits a new import issue:

1. User fills issue using template (no subcategory field)
2. Maintainer adds `import-approved` label
3. CI/CD runs `scripts/import-from-issue.mjs`
4. Script validates and imports to `skills/<category>/<id>/`
5. Script creates PR with changes
6. Maintainer reviews and merges

**The error should no longer occur!** ✅
