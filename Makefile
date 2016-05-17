PACKAGE_NAME = send-to-internals

.PHONY: all xpi copy-extlib signed clean

all: xpi

xpi: makexpi/makexpi.sh #copy-extlib
	makexpi/makexpi.sh -n $(PACKAGE_NAME) -o

#copy-extlib:
#	cp extlib/**/*.jsm modules/lib/

makexpi/makexpi.sh:
	git submodule update --init

signed: xpi
	makexpi/sign_xpi.sh -k $(JWT_KEY) -s $(JWT_SECRET) -p ./$(PACKAGE_NAME)_noupdate.xpi

clean:
	rm $(PACKAGE_NAME).xpi $(PACKAGE_NAME)_noupdate.xpi sha1hash.txt
