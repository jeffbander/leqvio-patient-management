declare module 'pdf-poppler' {
  interface ConversionOptions {
    type?: string;
    size?: number;
    density?: number;
    outputdir?: string;
    outputname?: string;
    page?: number;
  }

  export function convert(pdfBuffer: Buffer, options: ConversionOptions): Promise<string[]>;
}