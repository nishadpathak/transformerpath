(function () {
  'use strict';
  var ui = document.getElementById('fat-interactive');
  var check = document.getElementById('fat-check');
  var feedback = document.getElementById('fat-feedback');
  if (!ui || !check || !feedback) return;

  var reasoning = {
    accept: 'Not yet. The matching cover and reported pass are not enough: the R-03 sheet names a different serial. Hold signoff until the correct unit-linked evidence is verified.',
    hold: 'That follows this case’s inspection plan. Hold signoff while the quality team reconciles R-03 with the unit serial. The mismatch does not establish electrical failure.',
    reject: 'You spotted the mismatch. It breaks the evidence link, but it does not prove that this unit failed electrically. Record the issue and hold signoff while it is resolved.'
  };

  ui.hidden = false;
  ui.addEventListener('change', function () { feedback.textContent = ''; });
  check.addEventListener('click', function () {
    var option = ui.querySelector('input[name="fat-outcome"]:checked');
    feedback.textContent = option ? reasoning[option.value] : 'Choose a disposition, then check your decision.';
    if (!option) {
      var first = ui.querySelector('input');
      if (first) first.focus();
    }
  });
})();
