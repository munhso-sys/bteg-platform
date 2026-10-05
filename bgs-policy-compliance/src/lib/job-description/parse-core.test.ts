import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeParsedIntoDraft,
  parseJobDescriptionHtml,
  parseJobDescriptionText,
} from "./parse-core";

describe("parseJobDescriptionText", () => {
  it("maps Mongolian section headings", () => {
    const parsed = parseJobDescriptionText(`# Нягтлан бодогч
**Код:** 5116-16

Зорилго
Санхүүгийн бүртгэлийг хөтлөх.

Үндсэн үүрэг
- Тайлан бэлтгэх
- Баримт шалгах

Боловсрол
Бакалавр

Ерөнхий ур чадвар
- Excel
- Харилцаа
`);

    assert.equal(parsed.title, "Нягтлан бодогч");
    assert.equal(parsed.a_code, "5116-16");
    assert.match(parsed.purpose ?? "", /Санхүүгийн/);
    assert.deepEqual(parsed.duties, ["Тайлан бэлтгэх", "Баримт шалгах"]);
    assert.equal(parsed.education_level, "Бакалавр");
    assert.deepEqual(parsed.general_skills, ["Excel", "Харилцаа"]);
    assert.ok((parsed.markdown_body ?? "").includes("Зорилго"));
  });

  it("maps Загвар.docx label/value layout", () => {
    const parsed = parseJobDescriptionText(`
А. нийтлэг үндэслэл
Компанийн нэр:
"Болдтөмөр Ерөө Гол" ХХК
Байршил:
Сэлэнгэ аймаг
Нэгжийн нэр:
Дотоод хяналт шалгалтын хэлтэс
Албан тушаалын нэр:
Дарга-Хэлтсийн
Үндэсний ажил мэргэжлийн ангиллын код
1322-11
Албан тушаалын код
103
Шууд харьяалагдах албан тушаал:
Захирал-А, Захирал-Б
Харилцах хүрээ:
-Компани дотор: дотоод ажилтнууд
-Гадна: харилцагчид

B. дэлгэрэнгүй
Албан тушаалын зорилго:
Зорилгын текст энд.

Ажлын хуваарийн талаарх мэдээлэл:
14/14 хуваарь

С. албан тушаалын гүйцэтгэх үүрэг
№
Албан тушаалын гүйцэтгэх ажил үүрэг
Эхний үүрэг энд бичигдэнэ бөгөөд хангалттай урт.
Хоёр дахь үүрэг мөн хангалттай урт тексттэй.

D. Албан тушаалд тавигдах шаардлага
Боловсролын түвшин:
Бакалавр
`);

    assert.equal(parsed.company_name, '"Болдтөмөр Ерөө Гол" ХХК');
    assert.equal(parsed.unit_name, "Дотоод хяналт шалгалтын хэлтэс");
    assert.equal(parsed.title, "Дарга-Хэлтсийн");
    assert.equal(parsed.a_code, "1322-11");
    assert.equal(parsed.position_code, "103");
    assert.match(parsed.purpose ?? "", /Зорилгын текст/);
    assert.equal(parsed.duties?.length, 2);
    assert.equal(parsed.education_level, "Бакалавр");
    const comm = parsed.communication_scope as {
      company_internal?: string;
      external?: string;
    };
    assert.match(comm.company_internal ?? "", /дотоод/);
    assert.match(comm.external ?? "", /харилцагчид/);
  });

  it("merges non-empty parsed fields over draft", () => {
    const merged = mergeParsedIntoDraft(
      { title: "Хуучин", purpose: "Хуучин зорилго", a_code: "1111-11" },
      { purpose: "Шинэ зорилго", duties: ["А"] },
    );
    assert.equal(merged.title, "Хуучин");
    assert.equal(merged.purpose, "Шинэ зорилго");
    assert.equal(merged.a_code, "1111-11");
    assert.deepEqual(merged.duties, ["А"]);
  });
});

describe("parseJobDescriptionHtml", () => {
  it("reads two-column label rows and duties table", () => {
    const html = `
<table>
<tr><td><strong>Компанийн нэр:</strong></td><td>ABC ХХК</td></tr>
<tr><td><strong>Албан тушаалын нэр:</strong></td><td>Инженер</td></tr>
<tr><td><strong>Үндэсний ажил мэргэжлийн ангиллын код</strong></td><td>1322-11</td></tr>
<tr><td><strong>Албан тушаалын код</strong></td><td>103</td></tr>
<tr><td rowspan="2"><strong>Харилцах хүрээ:</strong></td><td>-Компани дотор: дотоод</td></tr>
<tr><td>-Гадна: гадаад</td></tr>
</table>
<p><strong>С. албан тушаалын гүйцэтгэх үүрэг</strong></p>
<table>
<tr><td><strong>№</strong></td><td><strong>Албан тушаалын гүйцэтгэх ажил үүрэг</strong></td></tr>
<tr><td></td><td>Эхний хангалттай урт үүргийн тайлбар энд.</td></tr>
<tr><td></td><td>Хоёр дахь хангалттай урт үүргийн тайлбар энд.</td></tr>
</table>
<p><strong>D. Албан тушаалд тавигдах шаардлага</strong></p>
<table>
<tr><td><strong>Боловсролын түвшин:</strong></td><td>Бакалавр</td></tr>
</table>`;
    const parsed = parseJobDescriptionHtml(html);
    assert.equal(parsed.company_name, "ABC ХХК");
    assert.equal(parsed.title, "Инженер");
    assert.equal(parsed.a_code, "1322-11");
    assert.equal(parsed.position_code, "103");
    assert.equal(parsed.duties?.length, 2);
    assert.equal(parsed.education_level, "Бакалавр");
    const comm = parsed.communication_scope as {
      company_internal?: string;
      external?: string;
    };
    assert.match(comm.company_internal ?? "", /дотоод/);
    assert.match(comm.external ?? "", /гадаад/);
  });
});
