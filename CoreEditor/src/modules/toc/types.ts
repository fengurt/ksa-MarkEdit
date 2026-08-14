export interface HeadingInfo {
  title: string;
  level: CodeGen_Int;
  from: CodeGen_Int;
  to: CodeGen_Int;
  selected: boolean;
  sectionEnd: CodeGen_Int;
  sectionWordCount: CodeGen_Int;
  documentWordCount: CodeGen_Int;
  lineStart: CodeGen_Int;
  lineEnd: CodeGen_Int;
  directChildCount: CodeGen_Int;
}
