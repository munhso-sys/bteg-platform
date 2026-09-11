import {
  reloadTemplatesFromImport,
  readStore,
} from "../src/lib/store";

reloadTemplatesFromImport();
const data = readStore();
const sample = data.templates.slice(0, 5).map((t) => ({
  code: t.code,
  title: t.title.slice(0, 40),
  questions: data.questions.filter((q) => q.templateId === t.id).length,
  sections: data.sections.filter((s) => s.templateId === t.id).length,
  legalMerges: data.questions.filter(
    (q) => q.templateId === t.id && q.legalMergeGroupId,
  ).length,
}));

console.log(
  JSON.stringify(
    {
      templates: data.templates.length,
      sections: data.sections.length,
      questions: data.questions.length,
      templatesWithSections: data.templates.filter((t) =>
        data.sections.some((s) => s.templateId === t.id),
      ).length,
      sample,
    },
    null,
    2,
  ),
);
