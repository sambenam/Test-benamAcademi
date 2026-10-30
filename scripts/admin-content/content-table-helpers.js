/**
 * Content admin helpers — split out of content-table.js so that file
 * stays under the size limit. Loaded before content-table.js, whose boot
 * hook calls initContentAdmin() and reaches everything here at run time.
 */

function populateCategorySelect() {
  const select = document.getElementById("newItemCategory");
  if (!select) return;

  if (typeof siteData === "undefined") {
    select.innerHTML = '<option value="">اطلاعات لود نشده است</option>';
    return;
  }

  const groups = [
    {
      title: "🎓 منوهای هدر: بخش دانشجویان و کنکور",
      categories: [
        "diploma",
        "associate_degree",
        "bachelor",
        "master",
        "phd",
        "konkur1",
        "konkur2",
        "konkur3",
        "Enterpreneurship_projects",
        "Enternship-projects",
        "Financial-project",
      ],
    },
    {
      title: "📂 منوهای هدر: فایل‌های دانلود حسابداری",
      categories: ["power_point", "Exel", "Word"],
    },
    {
      title: "📝 منوهای هدر: مقالات، ویدیوها و بخشنامه‌ها",
      categories: [
        "accounting_article",
        "software_training",
        "standards",
        "accounting_circulars",
        "videos",
      ],
    },
    {
      title: "🏠 سکشن‌های صفحه اصلی",
      categories: [
        "beginner",
        "intermediate",
        "advanced",
        "popularCourses",
        "newCourses",
        "specials",
        "articles",
        "exams",
      ],
    },
  ];

  // Sections the operator created. Without this the section exists on the
  // home page but there is no way to put anything in it.
  if (typeof loadHomeSections === "function") {
    const custom = loadHomeSections().map(function (section) {
      return section.key;
    });
    if (custom.length) {
      groups.push({ title: "✨ سکشن‌های سفارشی", categories: custom });
    }
  }

  let htmlOptions = "";
  groups.forEach((group) => {
    htmlOptions += `<optgroup label="${group.title}">`;
    group.categories.forEach((catKey) => {
      const category = siteData[catKey];
      if (category) {
        htmlOptions += `<option value="${catKey}">${category.title} (${catKey})</option>`;
      }
    });
    htmlOptions += `</optgroup>`;
  });

  select.innerHTML = htmlOptions;
}
