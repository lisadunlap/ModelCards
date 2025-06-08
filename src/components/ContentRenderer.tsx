import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

interface ContentRendererProps {
  content: string;
  className?: string;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ content, className }) => {
  // Enhanced LaTeX pattern detection
  const latexPatterns = [
    /\$/,                    // Dollar signs for math
    /\\[a-zA-Z]+/,          // LaTeX commands like \boxed, \frac, \sum, etc.
    /\\{|\\}/,              // LaTeX braces
    /\^{.*?}/,              // Superscripts
    /_{.*?}/,               // Subscripts
    /\\begin{.*?}/,         // LaTeX environments
    /\\end{.*?}/,           // LaTeX environments
  ];
  
  const hasLatex = latexPatterns.some(pattern => pattern.test(content));
  
  // Check if content contains markdown patterns
  const hasMarkdown = content.includes('```') || content.includes('**') || content.includes('*') || 
                     content.includes('#') || content.includes('[') || content.includes('|');

  // Debug logging
  console.log('ContentRenderer - Original content:', content);
  console.log('ContentRenderer - Has LaTeX:', hasLatex);
  console.log('ContentRenderer - Has Markdown:', hasMarkdown);

  // If no special formatting detected, render as plain text
  if (!hasLatex && !hasMarkdown) {
    return (
      <div className={`text-sm text-gray-700 bg-gray-50 p-3 rounded-md ${className || ''}`}>
        {content.split('\n').map((line, index) => (
          <p key={index} className={index === 0 ? '' : 'mt-2'}>
            {line}
          </p>
        ))}
      </div>
    );
  }

  // Preprocess content to handle LaTeX properly
  let processedContent = content;
  
  // Simpler and more targeted LaTeX preprocessing
  if (hasLatex) {
    // First, handle already wrapped math expressions (don't double-wrap)
    if (!content.includes('$')) {
      // Handle \boxed{} specifically since that's causing issues
      processedContent = processedContent.replace(
        /\\boxed\{([^}]+)\}/g,
        '$\\boxed{$1}$'
      );
      
      // Handle other common LaTeX commands with arguments
      processedContent = processedContent.replace(
        /\\(frac|sqrt|overline|underline|hat|bar|vec|mathbf|mathit|mathrm|text)\{([^}]+)\}/g,
        '$\\$1{$2}$'
      );
      
      // Handle LaTeX commands with two arguments (like \frac{}{})
      processedContent = processedContent.replace(
        /\\frac\{([^}]+)\}\{([^}]+)\}/g,
        '$\\frac{$1}{$2}$'
      );
    }
  }

  console.log('ContentRenderer - Processed content:', processedContent);

  return (
    <div className={`text-sm text-gray-700 bg-gray-50 p-3 rounded-md prose prose-sm max-w-none ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // Custom rendering for code blocks
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            return !isInline ? (
              <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          // Custom rendering for paragraphs to handle spacing
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          // Custom rendering for headings
          h1({ children }) {
            return <h1 className="text-lg font-semibold text-gray-900 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold text-gray-900 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold text-gray-900 mb-1">{children}</h3>;
          },
          // Custom rendering for lists
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          // Custom rendering for tables
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-2">
                <table className="min-w-full border border-gray-200 text-xs">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="px-2 py-1 bg-gray-50 border-b border-gray-200 text-left font-medium text-gray-900">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-2 py-1 border-b border-gray-200 text-gray-700">
                {children}
              </td>
            );
          },
          // Custom rendering for blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 mb-2">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default ContentRenderer; 