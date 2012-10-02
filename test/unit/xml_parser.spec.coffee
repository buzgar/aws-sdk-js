helpers = require('../helpers'); AWS = helpers.AWS

describe 'AWS.XMLParser', ->

  parse = (xml, rules, callback) ->
    new AWS.XMLParser(rules).parse(xml, callback)

  describe 'default behavior', ->

    rules = {} # no rules, rely on default parsing behavior

    it 'returns an empty object from an empty document', ->
      xml = '<xml/>'
      parse xml, rules, (data) ->
        expect(data).toEqual({})

    it 'converts string elements to properties', ->
      xml = '<xml><foo>abc</foo><bar>xyz</bar></xml>'
      parse xml, rules, (data) ->
        expect(data).toEqual({foo:'abc', bar:'xyz'})

    it 'converts nested elements into objects', ->
      xml = '<xml><foo><bar>yuck</bar></foo></xml>'
      parse xml, rules, (data) ->
        expect(data).toEqual({foo:{bar:'yuck'}})

    it 'returns everything as a string (even numbers)', ->
      xml = '<xml><count>123</count></xml>'
      parse xml, rules, (data) ->
        expect(data).toEqual({count:'123'})

    it 'flattens sibling elements of the same name', ->
      xml = '<xml><foo><bar>1</bar><bar>2</bar></foo></xml>'
      parse xml, rules, (data) ->
        expect(data).toEqual({foo:{bar:'1'}})

  describe 'lists', ->

    it 'Converts xml lists of strings into arrays of strings', ->
      xml = """
      <xml>
        <items>
          <item>abc</item>
          <item>xyz</item>
        </items>
      </xml>
      """
      rules = {items:{t:'a',m:{n:'item'}}}
      parse xml, rules, (data) ->
        expect(data).toEqual({items:['abc','xyz']})

  describe 'flattened lists', ->

  describe 'maps', ->

  describe 'booleans', ->

  describe 'timestamp', ->

  describe 'numbers', ->

  describe 'integers', ->

  describe 'renaming elements', ->

  describe 'parsing errors', ->

    it 'throws an error when unable to parse the xml', ->
      xml = 'asdf'
      rules = {}
      message = """
      Non-whitespace before first tag.
      Line: 0
      Column: 1
      Char: a
      """
      error = { code: 'AWS.XMLParser.Error', message: message }
      expect(-> new AWS.XMLParser(rules).parse(xml)).toThrow(error)
