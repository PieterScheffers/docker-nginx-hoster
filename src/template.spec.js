const { expect } = require('chai');
const { conditional, replace, runLoops } = require('./template');

describe('template.js', function() {
  describe('replace', function() {
    it('should replace all occurrences of an string', function() {
      const str = `
        this is some string

        {somevariable}

        some more text

        And it can also be used {somevariable} text.

        More text here...
      `;

      const replacements = { somevariable: 'this has been inserted' };

      const expected = `
        this is some string

        this has been inserted

        some more text

        And it can also be used this has been inserted text.

        More text here...
      `;

      expect(replace(str, replacements)).to.eql(expected);
    });
  });


  describe('conditional', function() {
    it('should remove all conditionals when true', function() {
      const str = `
        this is some string

        {if_hasVariable}
        woohoo it has the variable
        {/if_hasVariable}

        some more text

        And it can also be used {if_hasVariable}in between {/if_hasVariable}text.

        More text here...
      `;

      const expected = `
        this is some string

        
        woohoo it has the variable
        

        some more text

        And it can also be used in between text.

        More text here...
      `;

      expect(conditional(str, 'if_hasVariable', true)).to.eql(expected);
    });

    it('should remove all conditionals and the text between opening and closing when false', function() {
      const str = `
        this is some string

        {if_hasVariable}
        woohoo it has the variable
        {/if_hasVariable}

        some more text

        And it can also be used {if_hasVariable}in between {/if_hasVariable}text.

        More text here...
      `;

      const expected = `
        this is some string

        

        some more text

        And it can also be used text.

        More text here...
      `;

      expect(conditional(str, 'if_hasVariable', false)).to.eql(expected);
    });
  });

  describe('runLoops', function() {
    it('should replace all loops with some content replicated with variable inserted', function() {
      const str = `
        this is some string

        {{loop:jake vince wizzy}}
        My name is: {i}
        {{/loop}}

        {{loop:lars bobby kindle}}
        My name is: {i}
        {{/loop}}

        some more text
      `;

      const expected = `
        this is some string

        My name is: jake
        My name is: vince
        My name is: wizzy

        My name is: lars
        My name is: bobby
        My name is: kindle

        some more text
      `;

      expect(runLoops(str)).to.eql(expected);
    });
  });
});
