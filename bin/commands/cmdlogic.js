exports.addCommand = function(commandName, commandObject, commands) {
  try {
    commands[commandName] = commandObject;
  } catch (err) {
    console.error('Error addCommand: ' + err);
  }
};

exports.addCustomFunc = function(customFunc, bot) {
  try {
    customFunc(bot);
  } catch (err) {
    console.error('Error addCustomFunc: ' + err);
  }
};

exports.commandCount = function(commands) {
  return Object.keys(commands).length;
};
