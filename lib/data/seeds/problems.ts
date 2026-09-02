import type { Problem } from "@/lib/data/types";

export const seedProblems: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    statement:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. You may assume each input has exactly one solution, and you may not use the same element twice. Return the two indices as a list of two integers.",
    starterTemplate: "def two_sum(nums, target):\n    pass\n",
    sampleTests: [
      { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
      { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" },
    ],
    hiddenTests: [
      { input: "[1, 5, 3], 4", expectedOutput: "[0, 2]" },
      { input: "[3, 3], 6", expectedOutput: "[0, 1]" },
      { input: "[-3, 4, 3, 90], 0", expectedOutput: "[0, 2]" },
      { input: "[2, 1, 3, -1], 5", expectedOutput: "[0, 2]" },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "medium",
    statement:
      "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid. A string is valid if open brackets are closed by the same type of bracket, and brackets close in the correct order. Return a boolean.",
    starterTemplate: "def is_valid(s):\n    pass\n",
    sampleTests: [
      { input: '"()"', expectedOutput: "True" },
      { input: '"([)]"', expectedOutput: "False" },
    ],
    hiddenTests: [
      { input: '"()[]{}"', expectedOutput: "True" },
      { input: '"(]"', expectedOutput: "False" },
      { input: '"{[]}"', expectedOutput: "True" },
      { input: '"(("', expectedOutput: "False" },
    ],
  },
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "hard",
    statement:
      "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining. The list `height` gives the bar heights; return the total number of units of water trapped.",
    starterTemplate: "def trap(height):\n    pass\n",
    sampleTests: [
      { input: "[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]", expectedOutput: "6" },
      { input: "[4, 2, 0, 3, 2, 5]", expectedOutput: "9" },
    ],
    hiddenTests: [
      { input: "[]", expectedOutput: "0" },
      { input: "[0]", expectedOutput: "0" },
      { input: "[1, 0, 1]", expectedOutput: "1" },
      { input: "[3, 0, 0, 2, 0, 4]", expectedOutput: "10" },
    ],
  },
];