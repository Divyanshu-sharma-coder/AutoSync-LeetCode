/**
 * Markdown Engine: Generates algorithmic README documentation with Layman's Terms breakdown
 */

export class MarkdownEngine {
  constructor() {
    this.problemStatementTemplate = `
## 📝 Problem Statement

{problem_statement}

## 🎯 Approach

{approach_description}

## 📊 Complexity Analysis

- **Time Complexity:** {time_complexity}
- **Space Complexity:** {space_complexity}

## 💡 Key Insights

{key_insights}
`;
  }

  /**
   * Generate a complete README for a LeetCode problem
   */
  generateReadme(submissionData) {
    const { problem, submission, metadata } = submissionData;

    let readme = `# ${problem.id}. ${problem.title}\n\n`;

    // Properties section
    readme += this.generatePropertiesSection(problem, submission);
    readme += '\n\n';

    // Problem statement section
    readme += this.generateProblemStatementSection(problem);
    readme += '\n\n';

    // Solution code section
    readme += this.generateSolutionSection(submission);
    readme += '\n\n';

    // Performance metrics section
    readme += this.generatePerformanceSection(submission);
    readme += '\n\n';

    // Layman's explanation section
    readme += this.generateLaymansExplanation(problem, submission);

    return readme;
  }

  /**
   * Generate the properties section with metadata
   */
  generatePropertiesSection(problem, submission) {
    let section = '## 📋 Properties\n\n';

    const properties = [];

    if (problem.difficulty) {
      properties.push(`- **Difficulty:** ${problem.difficulty}`);
    }

    if (submission.language) {
      properties.push(`- **Language:** ${submission.language}`);
    }

    if (submission.runtime_ms) {
      properties.push(`- **Runtime:** ${submission.runtime_ms}ms`);
    }

    if (submission.memory_mb) {
      properties.push(`- **Memory:** ${submission.memory_mb}MB`);
    }

    if (submission.runtime_percentile) {
      properties.push(`- **Runtime Percentile:** ${submission.runtime_percentile.toFixed(2)}%`);
    }

    if (submission.memory_percentile) {
      properties.push(`- **Memory Percentile:** ${submission.memory_percentile.toFixed(2)}%`);
    }

    if (problem.url) {
      properties.push(`- **Problem Link:** [${problem.title}](${problem.url})`);
    }

    section += properties.join('\n');
    return section;
  }

  /**
   * Generate the problem statement section
   */
  generateProblemStatementSection(problem) {
    let section = '## 📖 Problem Statement\n\n';

    if (problem.description) {
      section += problem.description;
    } else {
      section += `Problem ID: ${problem.id}\n\nSlug: ${problem.slug}`;
    }

    return section;
  }

  /**
   * Generate the solution code section
   */
  generateSolutionSection(submission) {
    let section = '## 💻 Solution\n\n';

    if (submission.code) {
      const languageMap = {
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'js': 'javascript',
        'ts': 'typescript',
        'go': 'go',
        'rs': 'rust',
        'kt': 'kotlin',
        'swift': 'swift',
        'rb': 'ruby',
        'php': 'php',
        'sql': 'sql',
        'sh': 'bash'
      };

      const language = languageMap[submission.language_extension] || submission.language_extension;
      section += `\`\`\`${language}\n${submission.code}\n\`\`\``;
    } else {
      section += 'Solution code not available.';
    }

    return section;
  }

  /**
   * Generate the performance metrics section
   */
  generatePerformanceSection(submission) {
    let section = '## ⚡ Performance Metrics\n\n';

    const metrics = [];

    if (submission.runtime_ms) {
      metrics.push(`| Metric | Value |`);
      metrics.push(`| :--- | :--- |`);
      metrics.push(`| Runtime | ${submission.runtime_ms}ms |`);
    }

    if (submission.memory_mb) {
      if (metrics.length === 0) {
        metrics.push(`| Metric | Value |`);
        metrics.push(`| :--- | :--- |`);
      }
      metrics.push(`| Memory | ${submission.memory_mb}MB |`);
    }

    if (submission.runtime_percentile) {
      if (metrics.length === 0) {
        metrics.push(`| Metric | Value |`);
        metrics.push(`| :--- | :--- |`);
      }
      metrics.push(`| Runtime Percentile | ${submission.runtime_percentile.toFixed(2)}% |`);
    }

    if (submission.memory_percentile) {
      if (metrics.length === 0) {
        metrics.push(`| Metric | Value |`);
        metrics.push(`| :--- | :--- |`);
      }
      metrics.push(`| Memory Percentile | ${submission.memory_percentile.toFixed(2)}% |`);
    }

    if (metrics.length > 0) {
      section += metrics.join('\n');
    } else {
      section += 'Performance metrics not available.';
    }

    return section;
  }

  /**
   * Generate a Layman's explanation of the solution
   */
  generateLaymansExplanation(problem, submission) {
    let section = '## 🎓 Layman\'s Explanation\n\n';

    section += this.generateSimplifiedExplanation(problem, submission);

    return section;
  }

  /**
   * Generate a simplified explanation based on problem type
   */
  generateSimplifiedExplanation(problem, submission) {
    let explanation = '';

    if (!problem.title) {
      return 'A detailed explanation of the solution approach will be added here.';
    }

    const title = problem.title.toLowerCase();

    // Generic explanation based on problem characteristics
    explanation += `### What This Problem Is About\n\n`;

    if (title.includes('two sum') || title.includes('sum')) {
      explanation += `This problem asks you to find numbers in a collection that add up to a target value. `;
      explanation += `The key insight is to use a data structure (like a hash map) to remember numbers you've already seen, `;
      explanation += `so you can quickly check if the complement number exists.\n\n`;
    } else if (title.includes('reverse')) {
      explanation += `This problem involves reversing or flipping the order of elements. `;
      explanation += `The approach typically uses two pointers or a stack to swap elements from opposite ends.\n\n`;
    } else if (title.includes('palindrome')) {
      explanation += `A palindrome reads the same forwards and backwards. `;
      explanation += `The solution checks if a string or number has this property by comparing characters from both ends moving inward.\n\n`;
    } else if (title.includes('sort')) {
      explanation += `This problem requires arranging elements in a specific order. `;
      explanation += `Different sorting algorithms have different time complexities, and the choice depends on the constraints.\n\n`;
    } else if (title.includes('search')) {
      explanation += `This problem involves finding an element or pattern in a collection. `;
      explanation += `Binary search is often optimal for sorted data, while hash maps work for unsorted data.\n\n`;
    } else if (title.includes('tree') || title.includes('graph')) {
      explanation += `This problem involves traversing or manipulating a tree or graph structure. `;
      explanation += `Common approaches include depth-first search (DFS) and breadth-first search (BFS).\n\n`;
    } else if (title.includes('dynamic programming') || title.includes('dp')) {
      explanation += `This problem uses dynamic programming to break down a complex problem into overlapping subproblems. `;
      explanation += `We store intermediate results to avoid redundant calculations.\n\n`;
    } else {
      explanation += `This problem requires careful analysis of the input and constraints. `;
      explanation += `The solution uses appropriate data structures and algorithms to efficiently solve the problem.\n\n`;
    }

    explanation += `### How The Solution Works\n\n`;
    explanation += `1. **Input Analysis:** The solution first analyzes the input to understand the problem constraints.\n`;
    explanation += `2. **Algorithm Selection:** Based on the constraints, an appropriate algorithm is chosen.\n`;
    explanation += `3. **Implementation:** The algorithm is implemented using efficient data structures.\n`;
    explanation += `4. **Output:** The result is returned in the required format.\n\n`;

    explanation += `### Why This Approach\n\n`;
    explanation += `- **Efficiency:** The solution balances time and space complexity.\n`;
    explanation += `- **Readability:** The code is clear and easy to understand.\n`;
    explanation += `- **Scalability:** The approach works for various input sizes.\n`;

    return explanation;
  }

  /**
   * Parse and enhance problem description with layman's terms
   */
  enhanceProblemDescription(description) {
    if (!description) {
      return description;
    }

    // Add simple explanations for common technical terms
    let enhanced = description;

    const technicalTerms = {
      'array': 'a list of elements',
      'linked list': 'a chain of nodes connected by pointers',
      'tree': 'a hierarchical structure with a root and branches',
      'graph': 'a collection of nodes connected by edges',
      'hash map': 'a fast lookup table',
      'stack': 'a last-in-first-out (LIFO) data structure',
      'queue': 'a first-in-first-out (FIFO) data structure',
      'recursion': 'a function calling itself',
      'dynamic programming': 'breaking a problem into smaller subproblems and storing results',
      'binary search': 'efficiently finding an element in a sorted array',
      'sorting': 'arranging elements in order'
    };

    // Note: In a production system, you might use more sophisticated NLP techniques
    // For now, we'll keep the description as-is and enhance it contextually

    return enhanced;
  }

  /**
   * Generate a dry-run simulation table for the solution
   */
  generateDryRunTable(problem, submission) {
    let table = `## 🔍 Dry Run Example\n\n`;

    table += `| Step | Operation | Result |\n`;
    table += `| :--- | :--- | :--- |\n`;
    table += `| 1 | Initialize variables | Setup complete |\n`;
    table += `| 2 | Process input | Input parsed |\n`;
    table += `| 3 | Execute algorithm | Algorithm running |\n`;
    table += `| 4 | Return result | Solution found |\n`;

    return table;
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownEngine;
}
