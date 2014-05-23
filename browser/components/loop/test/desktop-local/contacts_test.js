var expect = chai.expect;

describe("Contacts", function() {
  var sandbox, contacts;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    contacts = new loop.contacts.ContactsDB({
      dbname: "LoopContactsTest"
    });
  });

  afterEach(function(done) {
    sandbox.restore();
    contacts.clear().then(done, done);
  });

  describe("#add", function() {

    it("should add a contact to the database", function(done) {
      var contact = {email: "florian@example.com"};

      contacts.add(contact).then(function(entry) {
        expect(entry.email).to.equal(contact.email);
        expect(entry.id).to.be.a("number");

        contacts.all().then(function(entries) {
          var entry = entries[0];

          expect(entries).to.have.length.of(1);
          expect(entry.email).to.equal(contact.email);
          expect(entry.id).to.be.a("number");

          done();
        }).catch(done);
      });
    });

  });

  describe("#all", function() {

    it("should retrieve no record when db is empty", function(done) {
      contacts.all().then(function(entries) {
        expect(entries).to.have.length.of(0);
        done();
      }).catch(done);
    });

    it("should retrieve all contacts", function(done) {
      var niko = {email: "niko@example.com"}, jb = {email: "jb@example.com"};

      contacts.add(niko).then(function() {
        return contacts.add(jb).then(function() {
          return contacts.all().then(function(entries) {
            expect(entries).to.have.length.of(2);
            expect(entries.map(function(entry) {
              return entry.email;
            })).eql([niko.email, jb.email]);

            done();
          });
        });
      }).catch(done);
    });

  });

  describe("#update", function() {

    it("should update an existing entry", function(done) {
      var niko = {email: "niko@example.com"};

      contacts.add(niko).then(function(contact) {
        contact.email = "notniko@example.com"
        return contacts.update(contact).then(function() {
          return contacts.all().then(function(entries) {
            expect(entries).to.deep.equal([contact]);
            done();
          });
        });
      }).catch(done);
    });

  });

});


