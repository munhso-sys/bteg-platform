declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfTextItem = { str?: string; transform?: number[] };
  type PdfPageData = {
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
  };
  type PdfParseOptions = {
    pagerender?: (pageData: PdfPageData) => Promise<string>;
  };
  type PdfParseResult = {
    text: string;
    numpages: number;
  };

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;
}

