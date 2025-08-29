
"use client";

import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './quill-custom.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent',
  'link', 'color', 'background'
];

const modules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link'],
    ['clean']
  ],
};


export function RichTextEditor({ value, onChange, readOnly = false }: RichTextEditorProps) {
  return (
    <div className="bg-background rounded-md border border-input">
        <ReactQuill 
          theme="snow" 
          value={value} 
          onChange={onChange}
          readOnly={readOnly}
          modules={modules}
          formats={formats}
          className="rich-text-editor"
        />
    </div>
  );
}
