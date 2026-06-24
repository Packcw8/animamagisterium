import type { NpcDefinition } from "../services/combatAdminService";
import type { MapEvent, StoryDialogueChoice, StoryDialogueNode } from "../services/mapService";

export type LegacyDialogueChoice = MapEvent["choices"][number];

type DialogueSceneStateInput = {
  event: MapEvent;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  npcs: NpcDefinition[];
  activeNodeId: string | null;
};

export function getDialogueSceneState({ event, nodes, choices, npcs, activeNodeId }: DialogueSceneStateInput) {
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
  const nodeChoices = activeNode ? choices.filter((choice) => choice.node_id === activeNode.id) : [];
  const legacyChoices = event.choices.length > 0 ? event.choices : [{ label: "Return to Map", action: "Continue" as const }];
  const nodeNpc = npcs.find((npc) => npc.id === activeNode?.npc_id);
  const eventNpc = npcs.find((npc) => npc.id === event.dialogue_npc_id);
  const npcName = nodeNpc?.name ?? activeNode?.npc_name ?? eventNpc?.name ?? event.npc_name;
  const npcPortrait = nodeNpc?.image_url ?? activeNode?.npc_portrait_url ?? eventNpc?.image_url ?? event.npc_portrait_url;
  const backgroundImageUrl = activeNode?.background_image_url ?? event.background_image_url;
  const dialogueText = activeNode?.dialogue_text || event.dialogue_text || "The trail grows quiet.";

  return {
    activeNode,
    nodeChoices,
    legacyChoices,
    npcName,
    npcPortrait,
    backgroundImageUrl,
    dialogueText,
  };
}

export function eventTypeName(type: MapEvent["event_type"]) {
  if (type === "battle") {
    return "Battle Event";
  }

  if (type === "clue") {
    return "Clue / Investigation Event";
  }

  if (type === "reward") {
    return "Reward Event";
  }

  return "Dialogue Event";
}

export function eventTriggerModeName(event: MapEvent) {
  if ((event.trigger_mode ?? "fixed") === "random") {
    return `Random ${Number(event.random_chance_percent ?? 0)}% after ${event.distance_marker_percent}%`;
  }

  return `Fixed at ${event.distance_marker_percent}%`;
}

export function choiceActionLabel(action: StoryDialogueChoice["action"]) {
  if (action === "go_to_node") {
    return "Go to another dialogue step";
  }

  if (action === "start_battle") {
    return "Start linked battle event";
  }

  if (action === "complete_event") {
    return "Complete this event";
  }

  if (action === "unlock_next_event") {
    return "Unlock next event";
  }

  if (action === "give_reward") {
    return "Give reward";
  }

  if (action === "end_conversation") {
    return "End conversation";
  }

  return "Return to map";
}

export function formatResourceName(resource: string) {
  if (resource === "magicka" || resource === "magika") {
    return "Mana";
  }
  if (resource === "health") {
    return "Health";
  }
  if (resource === "stamina") {
    return "Stamina";
  }
  return resource;
}

export function getChoiceTargetSummary(choice: StoryDialogueChoice, nodes: StoryDialogueNode[], events: MapEvent[]) {
  if (choice.action === "go_to_node") {
    const nextNode = nodes.find((node) => node.id === choice.next_node_id);
    return nextNode
      ? { label: `Then show dialogue step: ${nextNode.sort_order}. ${nextNode.title}`, isBroken: false }
      : { label: "Broken link: choose a target dialogue step", isBroken: true };
  }

  if (choice.action === "start_battle") {
    const battle = events.find((event) => event.id === choice.battle_event_id);
    return battle
      ? { label: `Then start battle: ${battle.title}`, isBroken: false }
      : { label: "Broken link: choose a target battle event", isBroken: true };
  }

  if (choice.action === "complete_event") {
    return { label: "Then complete this event", isBroken: false };
  }

  if (choice.action === "unlock_next_event") {
    return { label: "Then unlock the next trail event", isBroken: false };
  }

  if (choice.action === "give_reward") {
    return { label: `Then give reward: ${choice.reward_xp} XP${choice.reward_item ? ` and ${choice.reward_item}` : ""}`, isBroken: false };
  }

  if (choice.action === "end_conversation") {
    return { label: "Then end conversation", isBroken: false };
  }

  return { label: "Then return to map", isBroken: false };
}
