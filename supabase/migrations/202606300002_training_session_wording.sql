update public.training_attribute_configs
set
  effect = case attribute_key
    when 'strength' then 'Builds physical power for attack bonus and carrying capacity.'
    when 'endurance' then 'Builds stamina for longer journeys and sustained effort.'
    when 'agility' then 'Improves initiative, hit chance, critical chance, and evasion.'
    when 'intelligence' then 'Improves magical knowledge, learning, and problem solving.'
    when 'wisdom' then 'Improves healing, focus, insight, and calm decision making.'
    when 'charisma' then 'Improves social confidence, reputation, and leadership.'
    when 'spirit' then 'Improves resolve, support power, resistance, and inner discipline.'
    else effect
  end,
  activities = case attribute_key
    when 'strength' then 'Strength training, lifting heavy things, weighted exercise, bodyweight work, or physical labor.'
    when 'endurance' then 'Hiking, jogging, power walking, long walks, or steady physical work.'
    when 'agility' then 'Stretching, yoga, sprint intervals, balance drills, mobility work, or sport practice.'
    when 'intelligence' then 'Reading, studying, language learning, courses, writing notes, or focused research.'
    when 'wisdom' then 'Meditation, journaling, breathing practice, reflection, slow walks, or mindful rest.'
    when 'charisma' then 'Going out, socializing, calling someone, community activity, conversation practice, or encouraging others.'
    when 'spirit' then 'Prayer, faith study, religious study, gratitude practice, kindness, service, or personal reflection.'
    else activities
  end,
  unit = 'minutes',
  goal_template = case attribute_key
    when 'strength' then '{value}+ minutes of focused strength work'
    when 'endurance' then '{value}+ minutes of endurance work'
    when 'agility' then '{value}+ minutes of agility work'
    when 'intelligence' then '{value}+ minutes of study or learning'
    when 'wisdom' then '{value}+ minutes of wisdom practice'
    when 'charisma' then '{value}+ minutes of social practice'
    when 'spirit' then '{value}+ minutes of spirit practice'
    else goal_template
  end,
  starting_goal = 30,
  goal_increment = 0,
  updated_at = now()
where attribute_key in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit');
