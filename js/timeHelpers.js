const millisecond = 1;
function milliseconds(milliseconds) {
    return millisecond * milliseconds;
}

const second = millisecond * 1000;
function seconds(seconds) {
    return second * seconds;
}

const minute = second * 60;
function minutes(minutes) {
    return minute * minutes;
}

const hour = minute * 60;
function hours(hours) {
    return hour * hours;
}

const day = hour * 24;
function days(days) {
    return day * days;
}

const week = day * 24;
function weeks(weeks) {
    return week * weeks;
}

function isDurationOver(startTime, duration) {
    return Date.now() - startTime > duration;
}