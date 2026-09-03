import type { Problem } from "@/lib/data/types";

export const seedProblems: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    statement:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. You may assume each input has exactly one solution, and you may not use the same element twice. Return the two indices as a list of two integers.",
    starterTemplate: "def two_sum(nums, target):\n    pass\n",
    hintTiers: [
      "First, say out loud what has to be true for a pair of numbers to be the answer: two values at different positions that add up to the target. Restate the problem in plain words before you touch code.",
      "Think about each number as you scan the list: if you're looking at `nums[i]`, what would its partner have to be? Something like `target - nums[i]`. Ask yourself whether you could remember where you saw a matching value before, in a way you can look up quickly.",
      "This one is a classic hash map problem. As you scan left to right, remember each value alongside its index, and at every position check whether its missing partner is already remembered. Choosing the right lookup structure is the whole bottleneck — the runtime comes down to how you store what you've seen.",
    ],
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
    hintTiers: [
      "Think about what validity actually requires: every closing bracket has to match the most recent opening bracket that hasn't been closed yet, and every opening bracket eventually gets closed. Start by describing that process in words.",
      "A closing bracket must pair with the last unmatched opening bracket — not just any opening of the same kind. What data structure gives you exactly 'last in, first out'? Think about what should happen to an opening bracket the moment its match closes.",
      "This is the classic stack problem: push each opening bracket as you meet it, and when you meet a closing bracket, pop the top and check it matches. Anything that breaks that order, or leaves the stack non-empty at the end, is invalid.",
    ],
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
    hintTiers: [
      "Water can only rest on top of a bar when there are taller bars on both sides of it. Before thinking about totals, answer the smaller question: for one single bar, what decides how much water sits on it?",
      "For any bar, the water above it is the shorter of the tallest bar to its left and the tallest bar to its right, minus the bar's own height. So the real sub-problem is: can you know, for every position, the tallest bar seen so far on each side?",
      "The usual structure is a two-pointer pass: track the highest bar seen from each side and always advance the pointer that's under the lower maximum, adding the difference as you go. An equivalent, plainer structure is computing left-highest and right-highest arrays first, then summing the per-bar deltas.",
    ],
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