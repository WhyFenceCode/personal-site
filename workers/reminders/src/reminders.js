// What the weekly email reminds you about. Edit freely, then redeploy (see docs/guides/reminders.md).
//
//   every: 'week'    every Monday
//          '2weeks'  every other Monday
//          'month'   the first Monday of each month
export const REMINDERS = [
  { every: 'week', text: 'Update the song on repeat and your top artists', where: 'src/config/activities.yaml → listening' },
  { every: '2weeks', text: 'Reading: page progress, finished books, what\'s next', where: 'src/data/reading.txt' },
  { every: '2weeks', text: 'Request a Strava export and run `pnpm strava:import <zip>`', where: 'strava.com/account → Download or Delete Your Account' },
  { every: 'month', text: 'Any new places visited?', where: 'src/data/places.txt' },
  { every: 'month', text: 'New projects, roles, courses or certificates?', where: 'src/content/' },
  { every: 'month', text: 'Skills still accurate?', where: 'src/config/resume.yaml' },
];

// Extra lines added when the live site's /status.json shows something has gone stale (in days).
export const STALE_AFTER = {
  training: 40,  // Strava import older than this
  listening: 45, // listening "updated" month older than this
  build: 3,      // site not rebuilt for this long: the daily rebuild may be broken
};
