const nodes = {
  n1: ["n2", "n3", "n4", "n5"],
  n2: ["n6", "n6"],
  n3: ["n6", "n6"],
  n4: ["n6", "n6"],
  n5: ["n6", "n6", "n6"],
  n6: ["n7", "n8", "n9"],
  n8: ["n7"],
  n9: ["n7"],
  n7: [],
};

const paidEdges = new Set(["n6->n7", "n8->n7", "n9->n7"]);

function canReach(start, target, visited = new Set()) {
  if (start === target) return true;
  if (visited.has(start)) return false;
  visited.add(start);
  return (nodes[start] ?? []).some((next) => canReach(next, target, visited));
}

function pathsToTarget(start, target, path = [], results = []) {
  const nextPath = [...path, start];
  if (start === target) {
    results.push(nextPath);
    return results;
  }
  for (const next of nodes[start] ?? []) {
    pathsToTarget(next, target, nextPath, results);
  }
  return results;
}

const failures = [];

for (const node of ["n2", "n3", "n4", "n5"]) {
  if (!canReach(node, "n6")) {
    failures.push(`${node} does not reach toll node n6`);
  }
}

for (const path of pathsToTarget("n1", "n7")) {
  const paid = path.some((node, index) => paidEdges.has(`${node}->${path[index + 1]}`));
  if (!paid) {
    failures.push(`Unpaid path reaches n7: ${path.join(" -> ")}`);
  }
}

for (const edge of paidEdges) {
  const [from, to] = edge.split("->");
  if (!(nodes[from] ?? []).includes(to)) {
    failures.push(`Paid edge ${edge} is missing`);
  }
}

if (!nodes.n7 || nodes.n7.length !== 0) {
  failures.push("n7 should be a terminal dialogue node before Begin Journey action");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Opening dialogue validation passed: all branches reach toll, Node 7 requires paid edge, and paid choices are isolated.");
